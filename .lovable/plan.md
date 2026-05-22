## MVP scope (core gameplay only)

Build a single-page chess app at `/` with the **Studio Archive** design (light zinc/stone palette, Public Sans, panel-card aesthetic).

### Features included
- Interactive chessboard with click + drag-and-drop pieces
- Legal move validation via `chess.js` (handles castling, en passant, promotion, check/checkmate/stalemate)
- Highlight: selected square, legal target squares, last move, king-in-check
- Move list sidebar (algebraic notation, scrollable, paired by turn, current move highlighted)
- Captured pieces panel with material advantage
- Turn indicator + game status (check, checkmate, stalemate, draw)
- Controls: New Game, Undo, Flip Board, Resign
- Mode toggle: **vs Human** (local hot-seat) / **vs Engine** (Stockfish in a Web Worker)
- Promotion dialog (Q/R/B/N picker)
- Move sound on play/capture (Web Audio, no asset deps)
- Pawn promotion + post-game banner

### Out of scope (deferred for later phases)
Auth, online multiplayer, tournaments, puzzles, ratings, chat, themes beyond default, PGN/FEN import/export, evaluation bar, analysis review, mobile gestures beyond basic responsive. (Per "Core gameplay only" choice.)

### Technical approach

**Dependencies to add**
- `chess.js` — legal move engine, FEN/PGN, game state
- `react-chessboard` — accessible drag/drop board (skinnable to match Studio Archive palette via custom square/piece styles)
- Stockfish via CDN-loaded Web Worker (`stockfish.js` from `lila-stockfish-web` or `stockfish` npm `wasm` build) — runs entirely client-side, no backend

**File structure**
```
src/
  routes/
    index.tsx                 — replaces placeholder; renders ChessApp
  components/chess/
    ChessApp.tsx              — top-level layout (nav + main + sidebar)
    BoardPanel.tsx            — board + player strips + clocks (clocks visual-only in MVP)
    MoveList.tsx              — notation sidebar
    CapturedPieces.tsx        — material panel
    Controls.tsx              — New/Undo/Flip/Resign buttons
    PromotionDialog.tsx       — piece picker modal
    GameStatusBanner.tsx      — checkmate/draw overlay
  hooks/
    useChessGame.ts           — wraps chess.js, exposes move/undo/reset/state
    useStockfish.ts           — Web Worker wrapper, requests best move on opponent turn
  lib/
    chess-sounds.ts           — Web Audio tone generator for move/capture/check
```

**State model** — single `useChessGame` hook holding a `Chess` instance + history. All UI subscribes to its derived state (FEN, turn, legal moves for selected square, captured lists, status). No backend, no persistence in MVP.

**Design tokens** — port the prototype's palette into `src/styles.css` verbatim:
- `--background: #f4f4f5` (zinc-100 surface)
- `--card: #fafafa` (panel)
- `--foreground: #18181b` (zinc-900)
- `--muted-foreground: zinc-500`
- Public Sans loaded from Google Fonts in `__root.tsx` head
- Board light/dark squares: zinc-100 / zinc-300 (matches the muted archival feel — not the default Lichess green)
- Ring/border using `black/5` overlays as in prototype
- Page metadata (`head()` in index route): title "Grandmaster — Chess", description, og tags

### Layout match (composition is locked from prototype)
- Top nav h-12: brand label left, time-control segment, mode toggle right
- Main: max-w-1440, board centered (max-w-720) with opponent strip above + player strip below; right sidebar w-80 with Notation card (h-520) + 2x2 control grid
- All ring-1 ring-black/5, rounded-lg, panel surfaces — no shadows beyond `shadow-sm`

### Verification
After build: load `/`, click a pawn, confirm legal target dots appear, play a move, confirm move list updates, switch to vs Engine and confirm Stockfish replies within ~1s.
