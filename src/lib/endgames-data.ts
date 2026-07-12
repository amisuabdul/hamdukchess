// Curated endgame training positions. Each starts with the user to move
// and specifies a goal (mate in N, promote pawn, or achieve draw).

export type EndgameGoal =
  | { kind: "mate"; maxMoves: number } // deliver mate within N moves
  | { kind: "promote"; maxMoves: number } // promote a pawn within N moves
  | { kind: "draw"; maxMoves: number }; // hold the draw for N moves

export type EndgameCategory =
  | "basic-mates"
  | "pawn-endings"
  | "rook-endings"
  | "minor-pieces"
  | "queen-endings";

export type EndgamePosition = {
  id: string;
  title: string;
  description: string;
  category: EndgameCategory;
  difficulty: 1 | 2 | 3 | 4 | 5;
  fen: string; // side to move = the user's side
  userColor: "white" | "black";
  goal: EndgameGoal;
  hint?: string;
};

export const ENDGAME_CATEGORIES: { id: EndgameCategory; label: string; description: string }[] = [
  { id: "basic-mates", label: "Basic Mates", description: "K+Q, K+R, and two-rook mates." },
  { id: "pawn-endings", label: "Pawn Endings", description: "Opposition, the square, key squares." },
  { id: "rook-endings", label: "Rook Endings", description: "Lucena, Philidor, and rook activity." },
  { id: "minor-pieces", label: "Minor Pieces", description: "Bishop and knight endings." },
  { id: "queen-endings", label: "Queen Endings", description: "Queen vs pawn, perpetual defence." },
];

export const ENDGAMES: EndgamePosition[] = [
  // Basic Mates
  {
    id: "kqk-1",
    title: "King & Queen vs King",
    description: "Drive the black king to the edge and deliver mate.",
    category: "basic-mates",
    difficulty: 1,
    fen: "4k3/8/8/8/8/8/4K3/4Q3 w - - 0 1",
    userColor: "white",
    goal: { kind: "mate", maxMoves: 10 },
    hint: "Use the queen a knight-move away, then bring your king in.",
  },
  {
    id: "krk-1",
    title: "King & Rook vs King",
    description: "The rook cuts off — the king does the pushing.",
    category: "basic-mates",
    difficulty: 2,
    fen: "4k3/8/8/8/8/8/4K3/R7 w - - 0 1",
    userColor: "white",
    goal: { kind: "mate", maxMoves: 16 },
    hint: "Confine the black king to one file, then walk yours up.",
  },
  {
    id: "krrk-1",
    title: "Two Rooks Ladder Mate",
    description: "Two rooks can mate without the king's help.",
    category: "basic-mates",
    difficulty: 1,
    fen: "4k3/8/8/8/8/8/R7/1R2K3 w - - 0 1",
    userColor: "white",
    goal: { kind: "mate", maxMoves: 4 },
    hint: "Ladder: check on one rank, then the next.",
  },

  // Pawn Endings
  {
    id: "opposition-1",
    title: "Direct Opposition",
    description: "White to move — win by taking the opposition.",
    category: "pawn-endings",
    difficulty: 2,
    fen: "8/8/4k3/8/4P3/4K3/8/8 w - - 0 1",
    userColor: "white",
    goal: { kind: "promote", maxMoves: 12 },
    hint: "Get your king in front of the pawn.",
  },
  {
    id: "square-1",
    title: "The Rule of the Square",
    description: "Push the passed pawn — the enemy king can't catch it.",
    category: "pawn-endings",
    difficulty: 1,
    fen: "8/P7/8/8/8/8/6k1/4K3 w - - 0 1",
    userColor: "white",
    goal: { kind: "promote", maxMoves: 2 },
    hint: "One move away from a new queen.",
  },
  {
    id: "key-squares-1",
    title: "Key Squares",
    description: "Occupy a key square in front of the pawn to win.",
    category: "pawn-endings",
    difficulty: 3,
    fen: "8/8/8/8/3k4/8/3P4/3K4 w - - 0 1",
    userColor: "white",
    goal: { kind: "promote", maxMoves: 14 },
    hint: "Your king must reach c4, d4, or e4 with the move.",
  },

  // Rook Endings
  {
    id: "lucena-1",
    title: "The Lucena Position",
    description: "Bridge-building: the famous winning technique.",
    category: "rook-endings",
    difficulty: 4,
    fen: "1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1",
    userColor: "white",
    goal: { kind: "promote", maxMoves: 8 },
    hint: "Rc4 — build a bridge on the 4th rank.",
  },
  {
    id: "philidor-1",
    title: "The Philidor Position",
    description: "Third-rank defence — hold the draw with Black.",
    category: "rook-endings",
    difficulty: 4,
    fen: "3k4/8/3K4/3P4/8/r7/8/6R1 b - - 0 1",
    userColor: "black",
    goal: { kind: "draw", maxMoves: 20 },
    hint: "Keep your rook on the 3rd rank until the pawn advances.",
  },

  // Minor Pieces
  {
    id: "bishop-pawn-1",
    title: "Bishop & Pawn vs King",
    description: "Escort the pawn with your bishop and king.",
    category: "minor-pieces",
    difficulty: 3,
    fen: "8/8/8/3k4/8/2B5/3P4/3K4 w - - 0 1",
    userColor: "white",
    goal: { kind: "promote", maxMoves: 16 },
    hint: "The bishop controls the promotion square.",
  },
  {
    id: "wrong-bishop-1",
    title: "The Wrong-Colored Bishop",
    description: "Draw with the defending king in the corner.",
    category: "minor-pieces",
    difficulty: 4,
    fen: "8/8/8/8/8/1b6/1k6/K7 w - - 0 1",
    userColor: "white",
    goal: { kind: "draw", maxMoves: 20 },
    hint: "Stay in the a1 corner — the bishop can't drive you out.",
  },

  // Queen Endings
  {
    id: "queen-vs-pawn-1",
    title: "Queen vs Pawn on 7th",
    description: "Approach carefully — checks and pins.",
    category: "queen-endings",
    difficulty: 4,
    fen: "8/8/8/8/8/1k6/1p6/1K1Q4 w - - 0 1",
    userColor: "white",
    goal: { kind: "mate", maxMoves: 16 },
    hint: "Force the king in front of its own pawn to gain a tempo.",
  },
];

export function getEndgameById(id: string): EndgamePosition | undefined {
  return ENDGAMES.find((e) => e.id === id);
}

export function getEndgamesByCategory(category: EndgameCategory): EndgamePosition[] {
  return ENDGAMES.filter((e) => e.category === category);
}
