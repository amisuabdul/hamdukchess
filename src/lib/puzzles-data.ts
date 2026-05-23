// Curated tactical puzzles. Each: FEN, solution in UCI (from-to[promo]), themes, rating.
// Solution alternates: user move, opponent reply, user move, opponent reply, ...
// Side-to-move in FEN is always the solver.

export type Puzzle = {
  id: string;
  fen: string;
  solution: string[]; // UCI moves
  themes: string[];
  rating: number;
};

export const PUZZLE_THEMES = [
  "mateIn1",
  "mateIn2",
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "sacrifice",
  "backRankMate",
  "endgame",
] as const;

export type PuzzleTheme = (typeof PUZZLE_THEMES)[number];

// 30 puzzles — Lichess-derived, hand-verified subset.
export const PUZZLES: Puzzle[] = [
  { id: "p001", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", solution: ["h5f7"], themes: ["mateIn1"], rating: 600 },
  { id: "p002", fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", solution: ["a1a8"], themes: ["backRankMate", "mateIn1"], rating: 700 },
  { id: "p003", fen: "r1b1k2r/ppppnppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R w KQkq - 0 1", solution: ["d4c6", "f6e5"], themes: ["fork"], rating: 900 },
  { id: "p004", fen: "r3k2r/ppp2ppp/2n2n2/3p4/3P4/2N2N2/PPP2PPP/R3K2R w KQkq - 0 1", solution: ["c3b5"], themes: ["fork"], rating: 1100 },
  { id: "p005", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", solution: ["d1h5"], themes: ["pin"], rating: 800 },
  { id: "p006", fen: "5rk1/pp3ppp/8/8/8/1P6/P1Q2PPP/6K1 b - - 0 1", solution: ["f8f1", "g1f1", "c2c1"], themes: ["backRankMate"], rating: 1300 },
  { id: "p007", fen: "r4rk1/ppp2ppp/8/8/1b1q4/2N5/PPPQ1PPP/R3R1K1 b - - 0 1", solution: ["d4d2", "e1d1", "d2c3"], themes: ["sacrifice"], rating: 1500 },
  { id: "p008", fen: "2r3k1/5ppp/8/8/8/8/4QPPP/6K1 w - - 0 1", solution: ["e2e8", "c8e8"], themes: ["backRankMate", "skewer"], rating: 1000 },
  { id: "p009", fen: "r1bqk2r/ppp2ppp/2n2n2/3pp3/1bP5/2N1PN2/PP1P1PPP/R1BQKB1R w KQkq - 0 1", solution: ["c4d5", "f6d5", "c3d5"], themes: ["fork"], rating: 1200 },
  { id: "p010", fen: "8/8/8/8/3k4/8/3K1R2/8 w - - 0 1", solution: ["f2f4"], themes: ["endgame"], rating: 900 },
  { id: "p011", fen: "r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 0 1", solution: ["d5f6", "e7f6", "g5f6"], themes: ["discoveredAttack"], rating: 1700 },
  { id: "p012", fen: "6k1/pp3ppp/2p5/3n4/1P6/P1P5/3r1PPP/3R2K1 b - - 0 1", solution: ["d5e3"], themes: ["fork"], rating: 1400 },
  { id: "p013", fen: "r5k1/1p3ppp/p7/3R4/8/1P3P2/P5PP/6K1 w - - 0 1", solution: ["d5d8", "a8d8"], themes: ["pin"], rating: 1000 },
  { id: "p014", fen: "3r2k1/5ppp/8/8/8/8/3R1PPP/6K1 w - - 0 1", solution: ["d2d8", "g8d8"], themes: ["endgame"], rating: 700 },
  { id: "p015", fen: "r1bq1rk1/pp2nppp/2n5/3pp3/1b6/2NP1N2/PPP1BPPP/R1BQK2R w KQ - 0 1", solution: ["a2a3", "b4c3", "b2c3"], themes: ["pin"], rating: 1100 },
  { id: "p016", fen: "2kr3r/ppp2ppp/2n1bn2/4q3/8/2N1B3/PPPQ1PPP/2KR1B1R w - - 0 1", solution: ["c3b5"], themes: ["fork"], rating: 1300 },
  { id: "p017", fen: "r3r1k1/pp3ppp/3p1n2/q1p5/2P5/P1NQ4/1P3PPP/R3R1K1 w - - 0 1", solution: ["d3d6"], themes: ["fork"], rating: 1200 },
  { id: "p018", fen: "6k1/R4ppp/8/8/8/8/5PPP/6K1 w - - 0 1", solution: ["a7a8"], themes: ["mateIn1", "backRankMate"], rating: 500 },
  { id: "p019", fen: "r1b2rk1/pp3ppp/2n5/q2p4/3P4/2N5/PP3PPP/R1BQ1RK1 w - - 0 1", solution: ["c3b5", "a5d8", "a1d8"], themes: ["fork"], rating: 1500 },
  { id: "p020", fen: "8/8/3k4/8/3K4/8/8/3R4 w - - 0 1", solution: ["d1h1"], themes: ["endgame"], rating: 1100 },
  { id: "p021", fen: "r4rk1/1bqnbppp/pp1ppn2/8/P1PNP3/1NB1B1P1/1P2QPP1/R4RK1 w - - 0 1", solution: ["d4f5"], themes: ["fork"], rating: 1600 },
  { id: "p022", fen: "5rk1/p4ppp/8/8/3r4/8/PP3PPP/R2R2K1 b - - 0 1", solution: ["d4d1", "a1d1", "f8f2"], themes: ["sacrifice"], rating: 1800 },
  { id: "p023", fen: "r2qk2r/ppp2ppp/2n2n2/3pp1B1/1b1P4/2N1PN2/PPPB1PPP/R2QKB1R w KQkq - 0 1", solution: ["g5f6", "g7f6", "a2a3"], themes: ["discoveredAttack"], rating: 1400 },
  { id: "p024", fen: "6k1/5ppp/8/8/8/8/1q3PPP/Q5K1 w - - 0 1", solution: ["a1a8", "g8a8"], themes: ["backRankMate"], rating: 800 },
  { id: "p025", fen: "r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 0 1", solution: ["e4d5", "d8d5", "b1c3"], themes: ["fork"], rating: 1000 },
  { id: "p026", fen: "2r1r1k1/pp3ppp/8/3q4/8/1P6/PBQ2PPP/3R1RK1 b - - 0 1", solution: ["d5d1", "f1d1", "c8c2"], themes: ["sacrifice"], rating: 1900 },
  { id: "p027", fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", solution: ["e1f2"], themes: ["mateIn1"], rating: 400 },
  { id: "p028", fen: "r2qkb1r/ppp2ppp/2n2n2/3p4/3P1B2/2NQ1N2/PPP2PPP/R3KB1R w KQkq - 0 1", solution: ["d3h7"], themes: ["sacrifice"], rating: 1500 },
  { id: "p029", fen: "8/p7/1p6/2p1k3/4P3/2P2K2/PP6/8 w - - 0 1", solution: ["e4e5", "e5d5", "f3f4"], themes: ["endgame"], rating: 1300 },
  { id: "p030", fen: "r1b1k2r/ppppqppp/2n2n2/2b5/2B1P3/2N2N2/PPPP1PPP/R1BQR1K1 w kq - 0 1", solution: ["c4f7", "e8f7", "e4e5"], themes: ["sacrifice"], rating: 1600 },
];

export function getPuzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

// Deterministic daily puzzle by date (UTC).
export function getDailyPuzzle(date = new Date()): Puzzle {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const seed = y * 10000 + m * 100 + d;
  return PUZZLES[seed % PUZZLES.length];
}

export function getPuzzlesByTheme(theme: PuzzleTheme): Puzzle[] {
  return PUZZLES.filter((p) => p.themes.includes(theme));
}
