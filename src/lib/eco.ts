// Minimal ECO opening classifier — matches the longest UCI prefix.
// Covers the most common openings; falls back to null when nothing matches.

type EcoEntry = { eco: string; name: string; moves: string[] };

// UCI move sequences (from White's first move).
const ECO_TABLE: EcoEntry[] = [
  { eco: "A00", name: "Van 't Kruijs Opening", moves: ["e2e3"] },
  { eco: "A00", name: "Anderssen's Opening", moves: ["a2a3"] },
  { eco: "A00", name: "Sokolsky (Orangutan)", moves: ["b2b4"] },
  { eco: "A01", name: "Nimzo-Larsen Attack", moves: ["b2b3"] },
  { eco: "A02", name: "Bird's Opening", moves: ["f2f4"] },
  { eco: "A04", name: "Réti Opening", moves: ["g1f3"] },
  { eco: "A10", name: "English Opening", moves: ["c2c4"] },
  { eco: "A40", name: "Queen's Pawn Opening", moves: ["d2d4"] },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d2d4", "g8f6", "c1g5"] },
  { eco: "A46", name: "Indian Defence", moves: ["d2d4", "g8f6"] },
  { eco: "A80", name: "Dutch Defence", moves: ["d2d4", "f7f5"] },
  { eco: "B00", name: "King's Pawn Opening", moves: ["e2e4"] },
  { eco: "B01", name: "Scandinavian Defence", moves: ["e2e4", "d7d5"] },
  { eco: "B02", name: "Alekhine's Defence", moves: ["e2e4", "g8f6"] },
  { eco: "B06", name: "Modern Defence", moves: ["e2e4", "g7g6"] },
  { eco: "B07", name: "Pirc Defence", moves: ["e2e4", "d7d6"] },
  { eco: "B10", name: "Caro-Kann Defence", moves: ["e2e4", "c7c6"] },
  { eco: "B20", name: "Sicilian Defence", moves: ["e2e4", "c7c5"] },
  { eco: "B21", name: "Smith-Morra Gambit", moves: ["e2e4", "c7c5", "d2d4"] },
  { eco: "B23", name: "Closed Sicilian", moves: ["e2e4", "c7c5", "b1c3"] },
  { eco: "B27", name: "Sicilian Defence", moves: ["e2e4", "c7c5", "g1f3"] },
  { eco: "B50", name: "Sicilian, Old Sicilian", moves: ["e2e4", "c7c5", "g1f3", "d7d6"] },
  { eco: "B90", name: "Sicilian Najdorf", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"] },
  { eco: "C00", name: "French Defence", moves: ["e2e4", "e7e6"] },
  { eco: "C20", name: "King's Pawn Game", moves: ["e2e4", "e7e5"] },
  { eco: "C23", name: "Bishop's Opening", moves: ["e2e4", "e7e5", "f1c4"] },
  { eco: "C25", name: "Vienna Game", moves: ["e2e4", "e7e5", "b1c3"] },
  { eco: "C30", name: "King's Gambit", moves: ["e2e4", "e7e5", "f2f4"] },
  { eco: "C40", name: "King's Knight Opening", moves: ["e2e4", "e7e5", "g1f3"] },
  { eco: "C41", name: "Philidor Defence", moves: ["e2e4", "e7e5", "g1f3", "d7d6"] },
  { eco: "C42", name: "Petrov's Defence", moves: ["e2e4", "e7e5", "g1f3", "g8f6"] },
  { eco: "C44", name: "Scotch Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4"] },
  { eco: "C45", name: "Scotch Opening", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4", "e5d4"] },
  { eco: "C50", name: "Italian Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] },
  { eco: "C53", name: "Giuoco Piano", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"] },
  { eco: "C55", name: "Two Knights Defence", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"] },
  { eco: "C65", name: "Ruy Lopez, Berlin Defence", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6"] },
  { eco: "C68", name: "Ruy Lopez, Exchange", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5c6"] },
  { eco: "C78", name: "Ruy Lopez, Closed", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4"] },
  { eco: "D00", name: "Queen's Pawn Game", moves: ["d2d4", "d7d5"] },
  { eco: "D02", name: "London System", moves: ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d2d4", "d7d5", "c2c4"] },
  { eco: "D07", name: "Chigorin Defence", moves: ["d2d4", "d7d5", "c2c4", "b8c6"] },
  { eco: "D10", name: "Slav Defence", moves: ["d2d4", "d7d5", "c2c4", "c7c6"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d2d4", "d7d5", "c2c4", "e7e6"] },
  { eco: "D43", name: "Semi-Slav Defence", moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "g1f3", "c7c6"] },
  { eco: "E00", name: "Queen's Pawn Game", moves: ["d2d4", "g8f6", "c2c4"] },
  { eco: "E11", name: "Bogo-Indian Defence", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "f8b4"] },
  { eco: "E12", name: "Queen's Indian Defence", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "b7b6"] },
  { eco: "E20", name: "Nimzo-Indian Defence", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"] },
  { eco: "E60", name: "King's Indian Defence", moves: ["d2d4", "g8f6", "c2c4", "g7g6"] },
  { eco: "E70", name: "King's Indian, Classical", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4"] },
  { eco: "E90", name: "King's Indian, Fianchetto", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "g2g3"] },
];

export type EcoResult = { eco: string; name: string } | null;

export function classifyOpening(uciMoves: string[]): EcoResult {
  let best: EcoEntry | null = null;
  for (const entry of ECO_TABLE) {
    if (entry.moves.length > uciMoves.length) continue;
    let match = true;
    for (let i = 0; i < entry.moves.length; i++) {
      if (entry.moves[i] !== uciMoves[i]) { match = false; break; }
    }
    if (match && (!best || entry.moves.length > best.moves.length)) best = entry;
  }
  return best ? { eco: best.eco, name: best.name } : null;
}
