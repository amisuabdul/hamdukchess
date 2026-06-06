// Curated tactical puzzles. Each: FEN, solution in UCI (from-to[promo]), themes, rating.
// Solution alternates: user move, opponent reply, user move, opponent reply, ...
// Side-to-move in FEN is always the solver.
// Sourced from the Lichess open puzzle database (https://database.lichess.org/) — verified.

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
  "mateIn3",
  "fork",
  "pin",
  "skewer",
  "discoveredAttack",
  "sacrifice",
  "backRankMate",
  "deflection",
  "interference",
  "zwischenzug",
  "trapping",
  "endgame",
] as const;

export type PuzzleTheme = (typeof PUZZLE_THEMES)[number];

export const PUZZLES: Puzzle[] = [
  { id: "p001", fen: "5r1k/1b2N1pp/pq6/1n2p3/1P1pP3/P7/2P3PP/5R1K w - - 0 31", solution: ["f1f8"], themes: ["backRankMate", "endgame", "mateIn1"], rating: 502 },
  { id: "p002", fen: "r6k/2pnq1pp/1p3P2/2b4Q/2P2P2/p7/P1p3PP/R1B1R2K b - - 0 23", solution: ["e7e1"], themes: ["backRankMate", "mateIn1"], rating: 537 },
  { id: "p003", fen: "r4rk1/2p2ppp/p4q2/2P1p3/3n4/P2Q1bP1/5PP1/R3KB1R w KQ - 0 18", solution: ["d3h7"], themes: ["mateIn1"], rating: 561 },
  { id: "p004", fen: "4k3/3p1pQ1/p1q1p3/8/P5Pp/2P4P/1r4P1/3R1R1K b - - 0 29", solution: ["c6g2"], themes: ["endgame", "mateIn1"], rating: 584 },
  { id: "p005", fen: "5nk1/4qppp/8/p1Qp4/2pB4/P1Pb1P2/1P1R2PP/6K1 b - - 8 38", solution: ["e7e1"], themes: ["endgame", "mateIn1"], rating: 598 },
  { id: "p006", fen: "8/p7/5p2/1p3Bp1/1r1b1kP1/8/4R1K1/8 w - - 4 50", solution: ["e2e4"], themes: ["endgame", "mateIn1"], rating: 676 },
  { id: "p007", fen: "r4rk1/6pp/b1pbR1n1/p2p2N1/Pp1P4/1BP3P1/1P4PP/R1B2Q1K b - - 0 23", solution: ["f8f1"], themes: ["backRankMate", "mateIn1"], rating: 709 },
  { id: "p008", fen: "r3r1k1/p3pp1p/6pB/5b2/8/2QP2P1/qP2PP1P/2R3K1 w - - 7 32", solution: ["c3g7"], themes: ["mateIn1"], rating: 739 },
  { id: "p009", fen: "b4rk1/2pR2p1/1p4q1/6N1/7Q/4B3/1P3PPP/6K1 b - - 0 27", solution: ["g6b1", "e3c1", "b1c1", "d7d1", "c1d1"], themes: ["mateIn3"], rating: 786 },
  { id: "p010", fen: "1n3rk1/2p2p1p/p4p2/1p6/3qQ3/7P/P1B2P2/bN3RK1 w - - 2 20", solution: ["e4h7"], themes: ["mateIn1"], rating: 859 },
  { id: "p011", fen: "5R2/p7/1p1p3k/8/7p/1P6/P4KR1/7q w - - 0 53", solution: ["f8h8"], themes: ["endgame", "mateIn1"], rating: 946 },
  { id: "p012", fen: "8/8/r3kp2/3N4/4PP2/4K3/8/8 w - - 1 50", solution: ["d5c7", "e6d6", "c7a6"], themes: ["endgame", "fork"], rating: 962 },
  { id: "p013", fen: "8/3n1k1p/6pP/nPP2p2/8/2P1B3/5P2/5K2 w - - 1 34", solution: ["c5c6", "a5c4", "c6d7"], themes: ["endgame"], rating: 986 },
  { id: "p014", fen: "3k4/1pN2Q2/2p3B1/2P1b3/1PK3P1/8/1q6/8 b - - 4 62", solution: ["b2c3"], themes: ["endgame", "mateIn1"], rating: 1058 },
  { id: "p015", fen: "7r/pp2k3/2p4P/2n3P1/5N2/2P2P2/3K4/8 w - - 1 37", solution: ["f4g6", "e7f7", "g6h8", "f7g8", "h8g6"], themes: ["endgame", "fork"], rating: 1097 },
  { id: "p016", fen: "8/6b1/5kP1/1pB5/1P1p3P/3Kp3/8/8 w - - 3 55", solution: ["c5d4", "f6f5", "d4g7"], themes: ["deflection", "endgame", "skewer"], rating: 1139 },
  { id: "p017", fen: "r3k2r/1p3ppp/3pbQ2/2b5/3n4/P4NP1/3BPP1P/3RKB1R b Kkq - 0 16", solution: ["d4c2"], themes: ["mateIn1"], rating: 1176 },
  { id: "p018", fen: "3r2k1/6p1/6P1/4pPB1/pn6/4K3/1PP4Q/3q4 w - - 2 39", solution: ["h2h7", "g8f8", "h7h8"], themes: ["endgame", "mateIn2"], rating: 1214 },
  { id: "p019", fen: "5Rbk/1pp3p1/8/1p2K1P1/1P3Q2/P2P4/8/7q b - - 18 47", solution: ["h1d5"], themes: ["endgame", "mateIn1"], rating: 1278 },
  { id: "p020", fen: "r3k1nr/pppb3p/3p4/Q2P2P1/4q1p1/8/PPP3P1/RN3RK1 w kq - 0 16", solution: ["f1e1", "e4e1", "a5e1"], themes: ["pin"], rating: 1334 },
  { id: "p021", fen: "5Q2/2q4k/1p4p1/3Pp3/2Pp4/pPbP2P1/P5P1/6K1 w - - 2 41", solution: ["d5d6", "c7g7", "f8g7", "h7g7", "d6d7"], themes: ["endgame"], rating: 1354 },
  { id: "p022", fen: "4kb1r/3npppp/3p4/1PpPn3/1p2PB2/1Q3P2/1P3KPP/1r4NR b k - 3 17", solution: ["b1b2", "b3b2", "e5d3", "f2g3", "d3b2"], themes: ["fork", "sacrifice"], rating: 1400 },
  { id: "p023", fen: "5q1k/2R3b1/4p1Qp/pP2P3/P1p5/8/5PPK/8 b - - 1 44", solution: ["g7e5", "h2g1", "e5c7"], themes: ["endgame", "fork"], rating: 1442 },
  { id: "p024", fen: "2k1r3/pR4Rp/8/8/2r5/8/6PP/5K2 b - - 0 30", solution: ["c4f4", "f1g1", "e8e1"], themes: ["endgame", "mateIn2"], rating: 1518 },
  { id: "p025", fen: "8/5p1p/3N1kp1/P1n5/2P4P/8/6K1/8 w - - 1 41", solution: ["d6e4", "c5e4", "a5a6", "e4d6", "a6a7", "d6c4", "a7a8q"], themes: ["endgame", "sacrifice"], rating: 1556 },
  { id: "p026", fen: "3r2k1/4bpp1/p1Pq3p/8/4B3/Pp2Q2P/1P3PP1/2R3K1 b - - 0 30", solution: ["e7g5", "e3b3", "g5c1"], themes: ["endgame", "skewer"], rating: 1602 },
  { id: "p027", fen: "r4rk1/ppp3p1/3bq1P1/3p2p1/8/1P1PP3/PBP5/R2QK2R w KQ - 0 22", solution: ["h1h8", "g8h8", "d1h5", "h8g8", "h5h7"], themes: ["mateIn3", "sacrifice"], rating: 1614 },
  { id: "p028", fen: "r1b1kbnr/pp2pp1p/2n3p1/8/2B1q3/N1P1pN2/PP3PPP/R2QK2R w KQkq - 0 9", solution: ["c4f7", "e8f7", "f3g5", "f7g7", "g5e4"], themes: ["fork", "sacrifice"], rating: 1650 },
  { id: "p029", fen: "r1b1k2r/ppq2pp1/4p3/3p2P1/6n1/2PB1N2/PP4PP/2RQ1R1K w kq - 1 16", solution: ["d1a4", "c8d7", "a4g4"], themes: ["fork"], rating: 1750 },
  { id: "p030", fen: "2k5/p3r2p/1P1r2p1/1P2p2n/4Pp2/5P2/7P/R5RK w - - 0 30", solution: ["b6a7", "e7a7", "a1a7"], themes: ["endgame"], rating: 1790 },
  { id: "p031", fen: "r5k1/pp3r1p/6p1/3Q1b1P/8/2N5/PPP2q2/1K1R3R b - - 0 22", solution: ["f5c2", "b1a1", "c2d1"], themes: ["fork"], rating: 1841 },
  { id: "p032", fen: "5B2/2p1Rp1p/2k2q2/2p2B2/2P5/7P/4nPPK/8 w - - 6 31", solution: ["f5d7", "c6b6", "e7e2"], themes: ["endgame"], rating: 1911 },
  { id: "p033", fen: "5rk1/5ppp/p1pbn3/5q2/3r3P/1PN3P1/PB2QPK1/2RR4 b - - 2 28", solution: ["d4h4", "g3h4", "e6f4"], themes: ["sacrifice"], rating: 1943 },
  { id: "p034", fen: "8/1p6/5n2/1k1p1N1p/1P3p2/2Pr1P1P/2R2K2/8 w - - 4 38", solution: ["f2e2", "d3c3", "c2c3"], themes: ["endgame", "trapping"], rating: 1992 },
  { id: "p035", fen: "6k1/pp4p1/2pp4/4p1bP/4P3/BPNK4/P1P4r/5R2 b - - 5 25", solution: ["h2d2", "d3c4", "d2d4"], themes: ["endgame", "mateIn2"], rating: 2006 },
  { id: "p036", fen: "r1b3kr/1p2b1pp/pq1p1n2/2n3N1/4P3/2N1B3/PPPQ1PPP/R3K2R w KQ - 5 14", solution: ["c3d5", "f6d5", "d2d5", "c8e6", "g5e6"], themes: ["fork"], rating: 2028 },
  { id: "p037", fen: "8/4k3/1R4P1/8/2p5/1n1p3P/6P1/5K2 b - - 0 42", solution: ["c4c3", "b6b3", "c3c2", "b3d3", "c2c1q"], themes: ["endgame", "sacrifice"], rating: 2126 },
  { id: "p038", fen: "8/8/p4kp1/1p5p/1Pn1PK1P/P3B3/8/8 b - - 4 32", solution: ["c4e3", "f4e3", "g6g5", "h4g5", "f6g5"], themes: ["endgame"], rating: 2169 },
  { id: "p039", fen: "5R2/8/2R2np1/p4pk1/8/8/6PK/r7 b - - 5 57", solution: ["f6g4", "h2h3", "a1a3", "g2g3", "a3a2", "c6g6", "g5g6"], themes: ["endgame"], rating: 2213 },
  { id: "p040", fen: "8/1pQ5/4p1pk/p7/4P1P1/1nP3K1/1P5P/3q1r2 w - - 1 42", solution: ["g4g5", "h6g5", "c7e5", "f1f5", "h2h4", "g5h6", "e5h8"], themes: ["endgame"], rating: 2262 },];

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
