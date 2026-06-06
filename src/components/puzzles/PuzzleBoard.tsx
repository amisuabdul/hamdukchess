import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { usePuzzleSolver } from "@/hooks/usePuzzleSolver";
import type { Puzzle } from "@/lib/puzzles-data";
import { sounds } from "@/lib/chess-sounds";

type Props = {
  puzzle: Puzzle;
  onComplete?: (success: boolean) => void;
};

export function PuzzleBoard({ puzzle, onComplete }: Props) {
  const { fen, status, tryMove, hint, showHint, reset, playerColor } = usePuzzleSolver(puzzle);
  const [notified, setNotified] = useState<string | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);

  // Reset selection when puzzle changes
  useEffect(() => {
    setSelected(null);
  }, [puzzle.id]);

  // Fire onComplete once per puzzle resolution
  if (status === "solved" && notified !== puzzle.id + "solved") {
    sounds.end();
    onComplete?.(true);
    setNotified(puzzle.id + "solved");
  } else if (status === "failed" && notified !== puzzle.id + "failed") {
    onComplete?.(false);
    setNotified(puzzle.id + "failed");
  }

  const orientation = playerColor === "w" ? "white" : "black";

  // Legal-destination dots for currently-selected piece
  const legalTargets = useMemo<Set<string>>(() => {
    if (!selected) return new Set();
    try {
      const c = new Chess(fen);
      const moves = c.moves({ square: selected, verbose: true });
      return new Set(moves.map((m: { to: string }) => m.to));
    } catch {
      return new Set();
    }
  }, [selected, fen]);

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) {
      s[selected] = { background: "rgba(245, 166, 35, 0.55)" };
    }
    for (const t of legalTargets) {
      s[t] = {
        background:
          "radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 25%)",
      };
    }
    if (hint) {
      s[hint] = { background: "rgba(245, 166, 35, 0.65)", boxShadow: "inset 0 0 0 3px rgba(245,166,35,0.9)" };
    }
    return s;
  }, [selected, legalTargets, hint]);

  const attemptMove = (from: Square, to: Square) => {
    const ok = tryMove(from, to);
    if (ok) sounds.move();
    setSelected(null);
    return ok;
  };

  const handleDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    return attemptMove(sourceSquare as Square, targetSquare as Square);
  };

  const handleSquareClick = ({ square }: { square: string }) => {
    if (status !== "playing") return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) {
        setSelected(null);
        return;
      }
      if (legalTargets.has(sq)) {
        attemptMove(selected, sq);
        return;
      }
      // If clicked own piece, switch selection
    }
    // Select only if it's the player's piece on that square
    try {
      const c = new Chess(fen);
      const piece = c.get(sq);
      if (piece && piece.color === playerColor) {
        setSelected(sq);
      } else {
        setSelected(null);
      }
    } catch {
      setSelected(null);
    }
  };

  const options = {
    position: fen,
    onPieceDrop: handleDrop,
    onSquareClick: handleSquareClick,
    boardOrientation: orientation as "white" | "black",
    squareStyles,
    darkSquareStyle: { backgroundColor: "#b58863" },
    lightSquareStyle: { backgroundColor: "#f0d9b5" },
    animationDurationInMs: 200,
    allowDragging: status === "playing",
    id: "puzzle-board",
  };

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full max-w-[560px] mx-auto bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden touch-none select-none">
        <Chessboard options={options} />
        {status === "solved" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/60 backdrop-blur-sm pointer-events-none">
            <div className="text-center text-white">
              <p className="text-3xl font-serif font-bold">Solved</p>
              <p className="text-sm text-emerald-100 mt-1">+rating</p>
            </div>
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-sm pointer-events-none">
            <div className="text-center text-white">
              <p className="text-3xl font-serif font-bold">Not quite</p>
              <p className="text-sm text-red-100 mt-1">Try again or skip</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 max-w-[560px] mx-auto">
        <div className="text-xs text-zinc-500 uppercase tracking-wider">
          {playerColor === "w" ? "White" : "Black"} to play · {puzzle.themes.join(" · ")} · {puzzle.rating}
        </div>
        <div className="flex gap-2">
          <button
            onClick={showHint}
            disabled={status !== "playing"}
            className="px-3 py-1.5 text-xs font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
          >
            Hint
          </button>
          <button
            onClick={() => {
              setSelected(null);
              reset();
            }}
            className="px-3 py-1.5 text-xs font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
