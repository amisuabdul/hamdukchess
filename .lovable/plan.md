
## Scope

Build the full real-time game loop on top of the existing matchmaking + `submitMove` server functions, using Upstash Redis for ephemeral state and Postgres for durable state.

## 1. Infra & schema

**Install:** `@upstash/redis` (HTTP client, Worker-safe).

**New file:** `src/lib/redis.server.ts` — single client reading `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` inside a lazy proxy (matches `client.server.ts` pattern).

**Migration:** extend `games`:
- `variant text not null default 'standard'` — `'standard' | 'chess960'`
- `chess960_start_fen text`
- `initial_sec int`, `increment_sec int` — parsed from `time_control` on insert
- `time_white_ms int`, `time_black_ms int` — server-authoritative clocks
- `last_clock_update timestamptz`
- `draw_offer_by uuid`, `draw_offer_at timestamptz` (30s expiry)
- `takeback_offer_by uuid`, `takeback_offer_at timestamptz`
- `rated boolean default true` (takebacks block on rated)

**New table:** `game_events` (append-only log: move, draw_offer, draw_accept, draw_decline, takeback_*, abort, resign, flag, disconnect, reconnect, rematch). RLS: readable by participants and spectators (game is public), insert only via service role.

**New table:** `move_telemetry` (`game_id`, `ply`, `user_id`, `elapsed_ms`, `created_at`) for anti-cheat. Service-role insert only, readable by admins later.

**New column on `profiles`:** `flagged_for_review boolean default false`, `flag_reason text`.

## 2. Clock engine

Server is source of truth. In `submitMove`:
1. Compute `elapsed = now - last_clock_update`, deduct from mover's clock.
2. If `clock <= 0` and ply ≥ 2 → game ends with `end_reason='flag'`, winner = opponent.
3. Otherwise add `increment_sec * 1000` to mover's clock, set `last_clock_update = now`.
4. Persist `time_white_ms`, `time_black_ms`, log `move` event with `elapsed_ms`.

**New server fn `checkFlag(gameId)`** — clients call when their displayed clock hits 0 for the opposing player; server recomputes from `last_clock_update` and flags if expired. No background tick needed (Workers have no cron-per-game); clients interpolate client-side every 100ms.

## 3. Game actions (server fns in `src/lib/game-actions.functions.ts`)

- `offerDraw({gameId})` — set `draw_offer_by/at`, log event, broadcast via Realtime (postgres_changes on games row already fires).
- `respondDraw({gameId, accept})` — must be opponent; if accept → end game `result='draw'`, `end_reason='agreement'`. If decline or >30s → clear offer.
- `abortGame({gameId})` — only if `ply < 6` (move 3 each), no rating change, `end_reason='abort'`.
- `resignGame` already exists.
- `offerRematch({gameId})` / `respondRematch` — on accept, create new game with colors swapped, same `time_control`/`variant`, return new id.

All actions are RLS-safe (service role) and idempotent.

## 4. Premoves & takebacks

**Premoves are client-only** (no server state):
- `src/hooks/usePremoves.ts` — queue of up to 3 `{from,to,promo}`, validated against speculative chess.js after each own move.
- On opponent move realtime event: validate head of queue against new fen; if legal, fire `submitMove`; else clear queue.
- Render semi-transparent arrows in `play.$gameId.tsx`.

**Takebacks (casual only):**
- `requestTakeback({gameId})` — rejected if `rated`. Sets `takeback_offer_by/at`.
- `respondTakeback({gameId, accept})` — on accept: pop last move from `moves`, rebuild fen from prior move's fen, restore clocks from previous `move_telemetry` row, log event.

## 5. Presence & disconnect (Upstash Redis)

**Keys:**
- `presence:{user_id}` TTL 30s — `"online"` written by client heartbeat every 15s via `heartbeat()` server fn.
- `presence:count` TTL 60s — recomputed on demand via `SCAN presence:*` (cap 1000) for homepage.
- `game:{game_id}:disconnect:{user_id}` TTL 30s — set on `markDisconnected`.

**Server fns** in `src/lib/presence.functions.ts`:
- `heartbeat()` — `SET presence:{uid} online EX 30`.
- `markDisconnected({gameId})` — sets disconnect key, logs `disconnect` event (triggers realtime for opponent).
- `claimDisconnectWin({gameId})` — opponent calls after 30s; server checks key still set + game state, then:
  - ply < 10 → abort, no rating change
  - ply ≥ 10 → start counting opponent's clock down; if their clock now ≤ 0, end with `end_reason='disconnect'`.

**Client (`play.$gameId.tsx`):**
- `visibilitychange` + `beforeunload` → fire `markDisconnected`.
- Heartbeat interval while tab visible.
- On opponent disconnect event → show banner + 30s countdown; on expiry auto-call `claimDisconnectWin`.

## 6. Chess960

- `src/lib/chess960.ts` — generate one of 960 Fischer-random back ranks (bishops on opposite colors, king between rooks).
- Extend `findOrJoinMatch` RPC: accept `p_variant`, store with game. Queue key includes variant so 960 players only match 960 players.
- On game create: if `variant='chess960'`, generate fen, set `fen` + `chess960_start_fen`.
- `play.$gameId.tsx` already loads fen from row — works as-is. Castling: chess.js supports Chess960 castling when fen has correct castling rights letters.

## 7. Anti-cheat (logging only this pass)

In `submitMove`: insert `move_telemetry` with `elapsed_ms` from client payload.

**Background check (deferred):** Stockfish correlation requires worker infra we don't have yet. For now, add a simple heuristic in `submitMove` after game ends:
- If `avg(elapsed_ms) < 3000` across ≥ 20 moves → set `profiles.flagged_for_review = true`, `flag_reason = 'fast_moves'`. Engine correlation comes later.

## 8. Rate limits (Redis sliding window)

`src/lib/rate-limit.server.ts` — generic `checkRate(userId, action, limit, windowSec)` using Upstash `INCR` + `EXPIRE`.

Wire into: messages send (10/min), `offerRematch` (acts as invite, 20/day), `findOrJoinMatch` (1 active enforced by existing unique on `matchmaking_queue.user_id`).

## 9. UI changes (`play.$gameId.tsx`)

- Add clock displays (top/bottom of board), interpolated client-side.
- Buttons: Resign (exists), Offer Draw, Abort (if ply<6), Rematch (if game over), Request Takeback (casual only).
- Banners: incoming draw/takeback offer with Accept/Decline + 30s ring. Opponent disconnected with countdown.
- Premove arrows rendered via react-chessboard `customArrows`.

## Out of scope

- Stockfish engine-correlation anti-cheat (needs separate worker).
- Leaderboard Redis snapshot refresh job (no cron yet — keep reading from `profiles`).
- B2B API rate keys.
- Puzzle Storm / Battle Redis keys.
- Chat / report rate limits (separate features).

## File list

Created:
- `src/lib/redis.server.ts`
- `src/lib/rate-limit.server.ts`
- `src/lib/chess960.ts`
- `src/lib/game-actions.functions.ts`
- `src/lib/presence.functions.ts`
- `src/hooks/usePremoves.ts`
- `src/hooks/useGameClock.ts`
- `src/components/chess/GameActionBar.tsx`
- `src/components/chess/DrawOfferBanner.tsx`
- `src/components/chess/DisconnectBanner.tsx`
- migration

Edited:
- `src/lib/matchmaking.functions.ts` (clocks + telemetry + flag heuristic in `submitMove`; variant in `findOrJoinMatch`)
- `src/routes/play.$gameId.tsx` (clocks, premoves, action bar, banners, heartbeat)
- `src/routes/lobby.tsx` (variant toggle)
- `src/integrations/supabase/types.ts` (auto-regen)
