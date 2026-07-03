// Beginner tutorial content. Static — no CMS needed for now.
// Each tutorial is a series of steps. A step is either:
//   - "observe": read the instruction, click Next.
//   - "move": make the expected move on the board. Optional hint = from square.

export type TutorialStep =
  | {
      kind: "observe";
      fen: string;
      title: string;
      body: string;
    }
  | {
      kind: "move";
      fen: string;
      title: string;
      body: string;
      /** UCI move e.g. "e2e4" or "e7e8q". */
      answer: string;
      hint?: string;
    };

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  level: "starter" | "beginner" | "intermediate";
  estimatedMinutes: number;
  steps: TutorialStep[];
};

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const TUTORIALS: Tutorial[] = [
  {
    id: "board-basics",
    title: "The Board & Setup",
    description: "Learn the ranks, files, and how the pieces are placed at the start.",
    level: "starter",
    estimatedMinutes: 4,
    steps: [
      {
        kind: "observe",
        fen: START_FEN,
        title: "Welcome",
        body:
          "A chess board has 64 squares — 8 files (columns a–h) and 8 ranks (rows 1–8). White always sits at ranks 1–2, Black at ranks 7–8. The bottom-right square from White's view is a light square: 'light on right'.",
      },
      {
        kind: "observe",
        fen: START_FEN,
        title: "Piece values",
        body:
          "Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. The King is priceless — losing it ends the game. These values guide trades: giving up a knight for a rook is usually a good deal.",
      },
      {
        kind: "observe",
        fen: START_FEN,
        title: "White to move first",
        body:
          "White always plays the first move. Then the players alternate. Ready to try one?",
      },
      {
        kind: "move",
        fen: START_FEN,
        title: "Open the center",
        body:
          "A classic first move is pushing the king's pawn two squares — e2 to e4. It controls the center and lets the bishop and queen out. Play 1. e4.",
        answer: "e2e4",
        hint: "e2",
      },
    ],
  },
  {
    id: "how-pieces-move",
    title: "How the Pieces Move",
    description: "Pawn, knight, bishop, rook, queen, and king — one at a time.",
    level: "starter",
    estimatedMinutes: 8,
    steps: [
      {
        kind: "move",
        fen: "8/8/8/8/8/8/4P3/4K3 w - - 0 1",
        title: "The pawn",
        body:
          "Pawns move forward one square, but on their first move they may go two. They capture diagonally. Push the pawn to e4.",
        answer: "e2e4",
        hint: "e2",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/4K2N w - - 0 1",
        title: "The knight — L-shape",
        body:
          "Knights jump in an 'L': two squares one way, then one square perpendicular. They can leap over other pieces. Move the knight from h1 to f2.",
        answer: "h1f2",
        hint: "h1",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/2B1K3 w - - 0 1",
        title: "The bishop — diagonals",
        body:
          "Bishops slide any distance along diagonals. A bishop always stays on squares of the same color. Move the bishop from c1 to h6.",
        answer: "c1h6",
        hint: "c1",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/R3K3 w - - 0 1",
        title: "The rook — files & ranks",
        body:
          "Rooks slide any distance along files (up/down) and ranks (side to side). Move the rook from a1 to a8.",
        answer: "a1a8",
        hint: "a1",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/3QK3 w - - 0 1",
        title: "The queen — most powerful",
        body:
          "The queen combines rook and bishop — any distance along ranks, files, or diagonals. Slide the queen from d1 to h5.",
        answer: "d1h5",
        hint: "d1",
      },
      {
        kind: "move",
        fen: "8/8/8/8/8/8/8/4K3 w - - 0 1",
        title: "The king — one step",
        body:
          "The king moves one square in any direction. Protect it at all costs. Move the king from e1 to e2.",
        answer: "e1e2",
        hint: "e1",
      },
    ],
  },
  {
    id: "check-and-checkmate",
    title: "Check, Checkmate & Stalemate",
    description: "Recognise threats to the king and how the game ends.",
    level: "beginner",
    estimatedMinutes: 6,
    steps: [
      {
        kind: "observe",
        fen: "4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1",
        title: "What is check?",
        body:
          "A king is in 'check' when it is attacked. The player in check must respond: move the king, block the attack, or capture the attacker.",
      },
      {
        kind: "move",
        fen: "4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1",
        title: "Deliver checkmate",
        body:
          "Black's king on e8 has nowhere to run — the white king covers the escape squares. Move your queen to e7 and it's checkmate: attacked, and no legal reply.",
        answer: "e5e7",
        hint: "e5",
      },
      {
        kind: "observe",
        fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        title: "Stalemate — a draw",
        body:
          "If it's your turn and you have NO legal move but you are NOT in check, that's stalemate — the game is drawn. Beware of stalemating a losing opponent.",
      },
      {
        kind: "move",
        fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        title: "Back-rank mate",
        body:
          "Black's king is trapped behind its own pawns on the 8th rank. Slide the rook to e8 for mate.",
        answer: "e1e8",
        hint: "e1",
      },
    ],
  },
  {
    id: "special-moves",
    title: "Special Moves",
    description: "Castling, en passant, and pawn promotion.",
    level: "beginner",
    estimatedMinutes: 6,
    steps: [
      {
        kind: "observe",
        fen: "r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1",
        title: "Castling",
        body:
          "Castling gets your king to safety and activates a rook in one move. Requirements: neither piece has moved, no pieces between them, the king isn't in check and doesn't pass through check.",
      },
      {
        kind: "move",
        fen: "r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1",
        title: "Castle kingside",
        body:
          "Move your king from e1 to g1. The rook on h1 automatically hops to f1. Try it now.",
        answer: "e1g1",
        hint: "e1",
      },
      {
        kind: "observe",
        fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
        title: "En passant",
        body:
          "When a Black pawn moves two squares and lands beside your pawn (like d7-d5 next to your e5 pawn), you can capture it 'in passing' on the very next move — as if it moved one square.",
      },
      {
        kind: "move",
        fen: "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3",
        title: "Capture en passant",
        body: "Take the d5 pawn with your e5 pawn by moving to d6.",
        answer: "e5d6",
        hint: "e5",
      },
      {
        kind: "move",
        fen: "8/P7/8/8/8/8/8/4K2k w - - 0 1",
        title: "Promotion",
        body:
          "When a pawn reaches the last rank it MUST promote — almost always to a queen. Push your a7 pawn to a8 and promote.",
        answer: "a7a8q",
        hint: "a7",
      },
    ],
  },
  {
    id: "opening-principles",
    title: "Opening Principles",
    description: "Control the center, develop pieces, get your king safe.",
    level: "beginner",
    estimatedMinutes: 7,
    steps: [
      {
        kind: "move",
        fen: START_FEN,
        title: "1. Control the center",
        body:
          "Your first job is to fight for the four central squares (d4, e4, d5, e5). Push a central pawn — try 1. e4.",
        answer: "e2e4",
        hint: "e2",
      },
      {
        kind: "move",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        title: "2. Develop a knight",
        body:
          "Knights before bishops. Bring the knight to f3 — it attacks the center and prepares to castle.",
        answer: "g1f3",
        hint: "g1",
      },
      {
        kind: "move",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        title: "3. Black develops too",
        body:
          "Black plays 2...Nc6 to defend the e5 pawn and control d4. (Click Next.)",
        answer: "b8c6",
        hint: "b8",
      },
      {
        kind: "move",
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        title: "4. Bishop out",
        body:
          "Develop a bishop where it eyes the enemy king. Bb5 pins the knight against Black's king — this is the Ruy López.",
        answer: "f1b5",
        hint: "f1",
      },
      {
        kind: "observe",
        fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 3 3",
        title: "5. Castle soon",
        body:
          "With both minor pieces out, castling is next — that tucks the king away and connects the rooks. The three rules: center, development, king safety. Follow them and you'll survive most openings.",
      },
    ],
  },
];

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}
