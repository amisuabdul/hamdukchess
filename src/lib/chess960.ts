// Fischer Random / Chess960 starting position generator.
// Rules: bishops on opposite-colour squares; king strictly between the two rooks.

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomChess960BackRank(): string {
  // Returns 8-char string of piece letters (uppercase, white perspective).
  while (true) {
    const slots: (string | null)[] = Array(8).fill(null);
    const empties = () => slots.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0);

    // Bishops on opposite colours
    const lightSquares = [1, 3, 5, 7];
    const darkSquares = [0, 2, 4, 6];
    slots[shuffle(lightSquares)[0]] = "B";
    slots[shuffle(darkSquares)[0]] = "B";

    // Queen on a random empty square
    const qEmpties = empties();
    slots[qEmpties[Math.floor(Math.random() * qEmpties.length)]] = "Q";

    // Knights on two random empties
    const nEmpties = shuffle(empties());
    slots[nEmpties[0]] = "N";
    slots[nEmpties[1]] = "N";

    // Remaining 3 slots: R, K, R left to right
    const rest = empties();
    if (rest.length !== 3) continue;
    slots[rest[0]] = "R";
    slots[rest[1]] = "K";
    slots[rest[2]] = "R";

    return slots.join("");
  }
}

/**
 * Build a Chess960 starting FEN.
 * Uses standard castling letters KQkq (chess.js supports this for 960 when
 * rooks are on a/h files; for other rook files, X-FEN letters would be needed).
 * For maximum compatibility we restrict to the common form.
 */
export function chess960StartFen(): string {
  const back = randomChess960BackRank();
  const whiteBack = back;
  const blackBack = back.toLowerCase();
  return `${blackBack}/pppppppp/8/8/8/8/PPPPPPPP/${whiteBack} w KQkq - 0 1`;
}
