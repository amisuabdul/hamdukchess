import { useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { type Square } from "chess.js";
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

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (hint) s[hint] = { background: "rgba(245, 166, 35, 0.45)" };
    return s;
  }, [hint]);

  const handleDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    const ok = tryMove(sourceSquare as Square, targetSquare as Square);
    if (ok) sounds.move();
    return ok;
  };

  const options = {
    position: fen,
    onPieceDrop: handleDrop,
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
      <div className="relative aspect-square w-full max-w-[560px] mx-auto bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden">
        <Chessboard options={options} />
        {status === "solved" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/60 backdrop-blur-sm">
            <div className="text-center text-white">
              <p className="text-3xl font-serif font-bold">Solved</p>
              <p className="text-sm text-emerald-100 mt-1">+rating</p>
            </div>
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-sm">
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
            onClick={reset}
            className="px-3 py-1.5 text-xs font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
