# Puzzles + Game Analysis — Phased Build

This is a large surface (10+ features, 6 new tables, 3 realtime systems). Shipping it as one mega-migration is high risk. I'll cut it into 4 phases and ship them in order. You can stop me after any phase.

---

## Phase 1 — Puzzle foundation (all tiers)

**DB migration**
- `puzzles` — fen, solution (uci[]), themes (text[]), rating, creator_id (nullable for seeded), approved, daily_date (nullable, unique)
- `puzzle_ratings` — user_id, puzzle_id, success, attempts, leitner_box (1–5), next_due_at, solved_at
- `user_puzzle_stats` — user_id, rating, solved_count, current_streak, best_streak, last_solved_date

**Code**
- Migrate `src/lib/puzzle-storage.ts` (localStorage) → server fns in `src/lib/puzzles.functions.ts`: `getNextPuzzle` (Leitner-weighted: due failures first, then unseen near user rating ±100), `submitPuzzleAttempt` (ELO ±20, advance/reset Leitner box), `getDailyPuzzle(date)`, `getPuzzleById`
- Route: `src/routes/puzzles.daily.$date.tsx` with OG meta for share links
- Update `PuzzleHub` + `PuzzleBoard` to use server fns; keep localStorage as offline fallback for guests
- Seed 200 puzzles from Lichess open DB (CSV → migration insert)

---

## Phase 2 — Puzzle Storm (Plus/Gold gated)

**DB**: `puzzle_storm_scores` (user_id, score, solved, mistakes, played_at)

**Code**
- `src/routes/puzzles.storm.tsx` — 3-min timer, fetches puzzle stream, +1/−1 scoring
- Redis: live session state at `storm:{userId}` (TTL 5min), leaderboard at `storm:lb:daily:{yyyy-mm-dd}` and `storm:lb:alltime` (ZADD on completion)
- Server fns: `startStorm`, `submitStormResult`, `getStormLeaderboard`
- Tier gate via existing `subscription_tier` check; show upsell for free

---

## Phase 3 — Game Review (Plus/Gold)

**DB**: `game_analysis` (game_id, depth, eval_per_ply jsonb, classifications jsonb, accuracy_white, accuracy_black, opening_eco, opening_name)

**Code**
- `src/lib/game-review.ts` — client-side Stockfish runner (reuse `useStockfish`), depth 14 (Plus) / 20 (Gold), computes ACL + classifications (Brilliant / Good / Inaccuracy / Mistake / Blunder by cp delta thresholds)
- `src/components/chess/GameReview.tsx` — centipawn loss bar chart (Recharts), move list with classification icons, best-move overlay on board
- Wire into `play.$gameId.tsx` post-game ("Review game" button)
- Opening classification: bundled ECO table (`src/lib/eco.ts`, ~500 lines)

---

## Phase 4 — Deferred (call out, build later)

Each is a non-trivial feature on its own; I'll spin them up one at a time after Phase 3 lands:

- **Puzzle Battle** — Redis matchmaking + realtime channel, 1v1 race-to-5
- **Puzzle Creator Studio** — FEN editor + Stockfish forced-line verification + admin review queue
- **Opening Explorer** — needs Hamduk game stats aggregation cron, repertoire CRUD, opponent prep view
- **Endgame Tablebase** — Syzygy API proxy + Redis 24h cache
- **Weakness Detection** — batch job recomputing every 10 games, heatmap viz

---

## Technical notes

- Stockfish runs in the existing `useStockfish` worker — no new engine infra
- ELO formula reuses the K=20 model already in `puzzle-storage.ts`
- All new tables get `GRANT` + RLS scoped to `auth.uid()`; `puzzles.approved=true` is publicly readable
- Storm/Battle leaderboards live in Redis (already wired via `redis.server.ts`); periodic snapshot to Postgres for durability

## Order of operations

1. Phase 1 migration → approve → regen types → write puzzle server fns + hook up UI + seed
2. Phase 2 migration → storm route + Redis wiring
3. Phase 3 migration → review component + Stockfish analysis runner
4. Pause, review with you, then pick from Phase 4 list

Want me to start Phase 1?
