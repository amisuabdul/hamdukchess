# Analysis board + AI coach

Add a dedicated `/analysis` route with a read-only board, move list, PGN/FEN import/export, keyboard navigation, and an AI-powered "Explain this position" panel powered by Lovable AI (Gemini).

## User flow

1. From `/`, click **Open in Analysis** in the sidebar → current game's PGN is handed off via `sessionStorage` and loaded into the analysis board.
2. On `/analysis`, the user can:
   - Step through moves (click move in list, press ←/→ for prev/next, ↑/↓ for start/end).
   - Import a PGN (paste or upload `.pgn`) or a FEN string.
   - Export the current game as `.pgn` or copy the current FEN.
   - Flip the board, reset to start.
3. In the right sidebar, an **AI Coach** panel:
   - Shows the current position's FEN and side to move.
   - Button **Explain this position** → calls a server function that asks Gemini for a plain-language assessment (material, threats, plans for both sides, candidate moves).
   - Button **Recap whole game** → sends the full PGN and gets a 4–6 sentence narrative recap with key turning points.
   - Responses render as markdown, cached per FEN/PGN in component state so re-clicking the same position doesn't re-bill.

## Files to create

- `src/routes/analysis.tsx` — route with `head()` SEO + renders `<AnalysisApp />`.
- `src/components/chess/AnalysisApp.tsx` — board + toolbar + move list + AI panel layout.
- `src/components/chess/ReplayMoveList.tsx` — clickable SAN move list with current-ply highlight.
- `src/components/chess/AnalysisToolbar.tsx` — Import PGN, Import FEN, Export PGN, Copy FEN, Flip, Reset.
- `src/components/chess/PgnImportDialog.tsx` — paste + file upload, validates via chess.js.
- `src/components/chess/FenImportDialog.tsx` — paste FEN, validates.
- `src/components/chess/AiCoachPanel.tsx` — explain/recap buttons, markdown output, loading + error states.
- `src/hooks/useReplay.ts` — holds headers/moves/ply, derives current `Chess` and FEN.
- `src/hooks/useKeyboardNav.ts` — global arrow-key handler scoped to analysis page.
- `src/lib/pgn.ts` — `loadPgn(pgn)`, `exportPgn(headers, moves)` wrappers on chess.js.
- `src/lib/fen.ts` — `validateFen(fen)`, `startFen` constant.
- `src/lib/coach.functions.ts` — `explainPosition({ fen })` and `recapGame({ pgn })` server functions calling Lovable AI Gateway with `google/gemini-3-flash-preview`.

## Files to modify

- `src/components/chess/ChessApp.tsx` — add **Open in Analysis** button; on click write current PGN to `sessionStorage["analysis:pgn"]` and navigate to `/analysis`.
- `src/routes/__root.tsx` — add nav link to `/analysis` (only if a nav exists).
- `package.json` — add `react-markdown` dependency for rendering AI output.

## AI integration (server-side)

`src/lib/coach.functions.ts` exposes two `createServerFn({ method: "POST" })` handlers, each validating input with zod (FEN regex bound, PGN max length ~50KB):

- `explainPosition` → system prompt: "You are a chess coach. Given a FEN, return a concise plain-language assessment: material balance, immediate threats, strategic plans for both sides, and 2–3 candidate moves with short justification. Use markdown. ≤200 words." User message: the FEN.
- `recapGame` → system prompt: "You are a chess commentator. Given a PGN, produce a 4–6 sentence narrative recap highlighting the opening, key turning points (by move number), and why the game ended as it did. Use markdown." User message: the PGN.

Both call `https://ai.gateway.lovable.dev/v1/chat/completions` with `Authorization: Bearer ${process.env.LOVABLE_API_KEY}`, `stream: false` (non-streaming keeps the client simple for the first cut), return `{ markdown: string }`. 429 → `{ error: "Rate limited, try again in a moment." }`; 402 → `{ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }`. Errors surface as a toast in `AiCoachPanel`.

Called from the client via `useServerFn(explainPosition)` inside an event handler — not a loader — so the public route doesn't need auth and SSR doesn't 401.

## Verification

- `/` → play a few moves → **Open in Analysis** → board loads at final position with full move list.
- Click move 3 → board jumps to ply 3. Press → / ← → advances/rewinds. ↑ / ↓ → start/end.
- Paste Immortal Game PGN → loads cleanly. Paste invalid PGN → toast, prior state preserved.
- Paste a known FEN (e.g. Kasparov–Topalov 1999 mid-game) → board reflects it.
- Export PGN → downloads `.pgn` file readable in chess.com/lichess.
- Click **Explain this position** → markdown response appears in <8s; re-clicking same position returns cached result instantly.
- Click **Recap whole game** → narrative recap renders.
- Force a 429 (rapid clicks) → user-friendly toast, not a raw error.

## Out of scope

Stockfish eval bar, multi-PV engine lines, variation trees / annotations, cloud-saved studies, streaming AI responses — all candidates for follow-up phases.
