// Curated opening repertoire — each entry is a mainline sequence of UCI moves.
// Dynamic: the trainer picks a random starting side view and quizzes the user
// on every move played by their chosen color.

export type OpeningLine = {
  eco: string;
  name: string;
  color: "white" | "black"; // whose repertoire this line trains
  category: "e4" | "d4" | "flank" | "sicilian" | "indian" | "closed";
  description: string;
  ideas: string[]; // 2-4 key ideas / plans
  moves: string[]; // UCI mainline
};

export const OPENINGS: OpeningLine[] = [
  // ---- 1. e4 for White ----
  {
    eco: "C60",
    name: "Ruy Lopez, Main Line",
    color: "white",
    category: "e4",
    description:
      "The Spanish opening. White pressures the knight defending e5 and prepares long-term kingside expansion.",
    ideas: [
      "Pin the c6 knight to strain Black's center",
      "Retreat the bishop to a4 keeping the pin",
      "Build a slow c3/d4 center with kingside space",
    ],
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5", "a4b3", "d7d6", "c2c3"],
  },
  {
    eco: "C50",
    name: "Italian Game (Giuoco Pianissimo)",
    color: "white",
    category: "e4",
    description:
      "A quiet Italian setup with c3/d3, aiming for a slow build-up rather than early tactics.",
    ideas: ["Occupy the a2-g8 diagonal", "Play c3, d3, and reroute Nb1-d2-f1-g3", "Prepare a slow kingside attack"],
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6", "d2d3", "d7d6", "e1g1", "e8g8", "b1d2"],
  },
  {
    eco: "C42",
    name: "Petrov's Defence, Main Line",
    color: "black",
    category: "e4",
    description:
      "A solid symmetrical response to 1.e4 e5 2.Nf3 where Black counter-attacks the e4 pawn instead of defending e5.",
    ideas: ["Copy White's development", "Trade pieces for a quiet middlegame", "Aim for a solid draw or exploit a slip"],
    moves: ["e2e4", "e7e5", "g1f3", "g8f6", "f3e5", "d7d6", "e5f3", "f6e4", "d2d4", "d7d5", "f1d3"],
  },

  // ---- 2. Sicilian ----
  {
    eco: "B90",
    name: "Sicilian Najdorf",
    color: "black",
    category: "sicilian",
    description: "Black's most flexible Sicilian, keeping options open for ...e5, ...e6, or ...g6.",
    ideas: ["Prepare ...b5 for queenside play", "Keep the pawn on a6 to stop Nb5", "Choose a plan based on White's setup"],
    moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6", "c1e3", "e7e5", "d4b3", "c8e6"],
  },
  {
    eco: "B23",
    name: "Sicilian Grand Prix Attack",
    color: "white",
    category: "sicilian",
    description: "An aggressive anti-Sicilian with Nc3, f4, and Bc4 aiming directly at the black king.",
    ideas: ["Push f4-f5 for kingside attack", "Aim the bishop at f7", "Avoid mainline Sicilian theory"],
    moves: ["e2e4", "c7c5", "b1c3", "b8c6", "f2f4", "g7g6", "g1f3", "f8g7", "f1c4", "e7e6", "f4f5"],
  },

  // ---- 3. Caro-Kann / French ----
  {
    eco: "B10",
    name: "Caro-Kann Defence, Classical",
    color: "black",
    category: "e4",
    description: "Solid defence supporting ...d5 without blocking the light-squared bishop.",
    ideas: ["Develop the light-squared bishop outside the pawn chain", "Trade off White's e-pawn", "Aim for a healthy pawn structure"],
    moves: ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4", "c8f5", "e4g3", "f5g6", "h2h4", "h7h6", "g1f3"],
  },
  {
    eco: "C00",
    name: "French Defence, Advance Variation",
    color: "white",
    category: "e4",
    description: "White locks the center with e5 and plays for space and kingside attack.",
    ideas: ["Support the e5 pawn with c3, Nf3", "Cramp Black on the kingside", "Look for a f4-f5 break"],
    moves: ["e2e4", "e7e6", "d2d4", "d7d5", "e4e5", "c7c5", "c2c3", "b8c6", "g1f3", "d8b6", "a2a3", "g8h6"],
  },

  // ---- 4. Queen's Pawn ----
  {
    eco: "D02",
    name: "London System",
    color: "white",
    category: "d4",
    description: "A club favourite: solid, simple, and works against almost anything Black plays.",
    ideas: ["Develop bishop to f4 before e3", "Set up the pyramid: d4, e3, Nf3, Bf4, c3, Bd3", "Look for Ne5 and kingside attack"],
    moves: ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4", "e7e6", "e2e3", "f8d6", "f4g3", "e8g8", "f1d3", "b8d7", "b1d2"],
  },
  {
    eco: "D30",
    name: "Queen's Gambit Declined, Orthodox",
    color: "black",
    category: "d4",
    description: "The classical way to decline the gambit — build a solid center with ...e6 and ...c6.",
    ideas: ["Maintain the pawn on d5", "Develop pieces harmoniously", "Trade minor pieces if space is cramped"],
    moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c1g5", "f8e7", "e2e3", "e8g8", "g1f3", "b8d7", "a1c1", "c7c6"],
  },
  {
    eco: "D10",
    name: "Slav Defence",
    color: "black",
    category: "d4",
    description: "Defends d5 with the c-pawn, keeping the light-squared bishop's diagonal open.",
    ideas: ["Free the c8 bishop early", "Aim for ...dxc4 with tempo on the bishop", "Play a solid Semi-Slav / Meran setup"],
    moves: ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6", "b1c3", "d5c4", "a2a4", "c8f5", "e2e3", "e7e6"],
  },

  // ---- 5. Indian Defences ----
  {
    eco: "E60",
    name: "King's Indian Defence",
    color: "black",
    category: "indian",
    description: "Black cedes the center to strike back with ...e5 or ...c5 and a kingside attack.",
    ideas: ["Fianchetto the dark-squared bishop", "Prepare ...e5 in the center", "Storm the white king with ...f5, ...g5, ...f4"],
    moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4", "d7d6", "g1f3", "e8g8", "f1e2", "e7e5"],
  },
  {
    eco: "E20",
    name: "Nimzo-Indian Defence",
    color: "black",
    category: "indian",
    description: "Pins the c3 knight, fighting for e4 with pieces rather than pawns.",
    ideas: ["Double White's c-pawns with ...Bxc3+", "Fight for the e4 square", "Play flexibly against various White setups"],
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4", "e2e3", "e8g8", "f1d3", "d7d5", "g1f3", "c7c5"],
  },
  {
    eco: "E12",
    name: "Queen's Indian Defence",
    color: "black",
    category: "indian",
    description: "Black fianchettos the light-squared bishop to fight for e4 and control the long diagonal.",
    ideas: ["Trade or reroute the light-squared bishop", "Contest the long diagonal", "Break with ...c5 or ...d5"],
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "b7b6", "g2g3", "c8b7", "f1g2", "f8e7", "e1g1", "e8g8"],
  },

  // ---- 6. Flank ----
  {
    eco: "A10",
    name: "English Opening, Symmetrical",
    color: "white",
    category: "flank",
    description: "1.c4 aiming for a flexible flank setup that can transpose into many structures.",
    ideas: ["Fianchetto the light-squared bishop", "Choose your center with e3, d4, or delay both", "Play against Black's setup"],
    moves: ["c2c4", "c7c5", "g1f3", "g8f6", "g2g3", "b7b6", "f1g2", "c8b7", "e1g1", "g7g6", "b1c3", "f8g7"],
  },
  {
    eco: "A04",
    name: "Réti Opening",
    color: "white",
    category: "flank",
    description: "1.Nf3 followed by c4 and g3 — hypermodern control of the center with pieces.",
    ideas: ["Delay pawn commitments", "Fianchetto both bishops", "Transpose into English or Catalan structures"],
    moves: ["g1f3", "d7d5", "c2c4", "e7e6", "g2g3", "g8f6", "f1g2", "f8e7", "e1g1", "e8g8", "b2b3", "b7b6"],
  },
];

export function getOpeningById(eco: string): OpeningLine | undefined {
  return OPENINGS.find((o) => o.eco === eco);
}

export function opeCategoryLabel(cat: OpeningLine["category"]): string {
  switch (cat) {
    case "e4": return "1. e4 Openings";
    case "d4": return "1. d4 Openings";
    case "sicilian": return "Sicilian Systems";
    case "indian": return "Indian Defences";
    case "flank": return "Flank Openings";
    case "closed": return "Closed Games";
  }
}
