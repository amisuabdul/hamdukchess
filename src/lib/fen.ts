import { Chess } from "chess.js";

export const startFen =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function validateFen(fen: string): { ok: true } | { ok: false; error: string } {
  try {
    new Chess(fen.trim());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid FEN" };
  }
}
