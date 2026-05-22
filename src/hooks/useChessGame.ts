import { useCallback, useMemo, useRef, useState } from "react";
import { Chess, type Square, type Move, type PieceSymbol, type Color } from "chess.js";

export type GameStatus =
  | { kind: "active" }
  | { kind: "check"; turn: Color }
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "draw"; reason: string }
  | { kind: "resigned"; winner: Color };

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNTS: Record<PieceSymbol, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

function deriveCaptured(chess: Chess) {
  const counts: Record<Color, Record<PieceSymbol, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq) counts[sq.color][sq.type]++;
    }
  }
  const captured: Record<Color, PieceSymbol[]> = { w: [], b: [] };
  let advantage = 0;
  (["w", "b"] as Color[]).forEach((color) => {
    (Object.keys(START_COUNTS) as PieceSymbol[]).forEach((p) => {
      const missing = START_COUNTS[p] - counts[color][p];
      for (let i = 0; i < missing; i++) captured[color].push(p);
      // captured pieces of `color` benefit the opposite side
      const sign = color === "w" ? -1 : 1;
      advantage += sign * missing * PIECE_VALUE[p];
    });
  });
  return { captured, advantage };
}

export function useChessGame() {
  const chessRef = useRef(new Chess());
  const [, force] = useState(0);
  const [resignedBy, setResignedBy] = useState<Color | null>(null);
  const rerender = useCallback(() => force((n) => n + 1), []);

  const chess = chessRef.current;

  const status: GameStatus = useMemo(() => {
    if (resignedBy) return { kind: "resigned", winner: resignedBy === "w" ? "b" : "w" };
    if (chess.isCheckmate()) return { kind: "checkmate", winner: chess.turn() === "w" ? "b" : "w" };
    if (chess.isStalemate()) return { kind: "stalemate" };
    if (chess.isInsufficientMaterial()) return { kind: "draw", reason: "Insufficient material" };
    if (chess.isThreefoldRepetition()) return { kind: "draw", reason: "Threefold repetition" };
    if (chess.isDraw()) return { kind: "draw", reason: "50-move rule" };
    if (chess.inCheck()) return { kind: "check", turn: chess.turn() };
    return { kind: "active" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess.fen(), resignedBy]);

  const gameOver = status.kind === "checkmate" || status.kind === "stalemate" || status.kind === "draw" || status.kind === "resigned";

  const makeMove = useCallback(
    (from: Square, to: Square, promotion: PieceSymbol = "q"): Move | null => {
      if (gameOver) return null;
      try {
        const move = chess.move({ from, to, promotion });
        rerender();
        return move;
      } catch {
        return null;
      }
    },
    [chess, gameOver, rerender],
  );

  const undo = useCallback(() => {
    chess.undo();
    setResignedBy(null);
    rerender();
  }, [chess, rerender]);

  const reset = useCallback(() => {
    chess.reset();
    setResignedBy(null);
    rerender();
  }, [chess, rerender]);

  const resign = useCallback(
    (color: Color) => {
      if (gameOver) return;
      setResignedBy(color);
    },
    [gameOver],
  );

  const legalMovesFor = useCallback(
    (square: Square): Square[] => chess.moves({ square, verbose: true }).map((m) => m.to as Square),
    [chess],
  );

  const { captured, advantage } = useMemo(
    () => deriveCaptured(chess),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chess.fen()],
  );

  const history = chess.history({ verbose: true });
  const lastMove = history[history.length - 1];

  return {
    fen: chess.fen(),
    turn: chess.turn(),
    history,
    lastMove,
    status,
    gameOver,
    captured,
    advantage,
    makeMove,
    undo,
    reset,
    resign,
    legalMovesFor,
    inCheck: chess.inCheck(),
  };
}
