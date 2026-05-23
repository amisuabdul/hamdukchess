import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { Puzzle } from "@/lib/puzzles-data";

export type SolverStatus = "loading" | "playing" | "solved" | "failed";

export function usePuzzleSolver(puzzle: Puzzle) {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(puzzle.fen);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<SolverStatus>("loading");
  const [hint, setHint] = useState<string | null>(null);

  // Reset when puzzle changes
  useEffect(() => {
    chess.load(puzzle.fen);
    setFen(puzzle.fen);
    setStepIndex(0);
    setStatus("playing");
    setHint(null);
  }, [puzzle, chess]);

  const playerColor = useMemo(() => puzzle.fen.split(" ")[1] as "w" | "b", [puzzle.fen]);

  const tryMove = useCallback(
    (from: Square, to: Square, promotion?: string): boolean => {
      if (status !== "playing") return false;
      const expected = puzzle.solution[stepIndex];
      if (!expected) return false;
      const expFrom = expected.slice(0, 2);
      const expTo = expected.slice(2, 4);
      const expPromo = expected[4];

      const matches = from === expFrom && to === expTo && (expPromo ? promotion === expPromo : true);
      if (!matches) {
        // Still try to make the move to show feedback
        try {
          const m = chess.move({ from, to, promotion: promotion ?? "q" });
          if (m) {
            setFen(chess.fen());
            setStatus("failed");
            return true;
          }
        } catch {
          /* illegal */
        }
        setStatus("failed");
        return false;
      }

      const m = chess.move({ from, to, promotion: promotion ?? expPromo ?? "q" });
      if (!m) return false;
      setFen(chess.fen());
      const nextIdx = stepIndex + 1;

      // If solution complete
      if (nextIdx >= puzzle.solution.length) {
        setStatus("solved");
        setStepIndex(nextIdx);
        return true;
      }

      // Play opponent's reply after a short delay
      setTimeout(() => {
        const reply = puzzle.solution[nextIdx];
        const rFrom = reply.slice(0, 2) as Square;
        const rTo = reply.slice(2, 4) as Square;
        const rPromo = reply[4];
        chess.move({ from: rFrom, to: rTo, promotion: rPromo ?? "q" });
        setFen(chess.fen());
        const after = nextIdx + 1;
        setStepIndex(after);
        if (after >= puzzle.solution.length) setStatus("solved");
      }, 350);

      setStepIndex(nextIdx);
      return true;
    },
    [chess, puzzle, stepIndex, status],
  );

  const showHint = useCallback(() => {
    const expected = puzzle.solution[stepIndex];
    if (expected) setHint(expected.slice(0, 2));
  }, [puzzle, stepIndex]);

  const reset = useCallback(() => {
    chess.load(puzzle.fen);
    setFen(puzzle.fen);
    setStepIndex(0);
    setStatus("playing");
    setHint(null);
  }, [chess, puzzle]);

  return { fen, status, tryMove, hint, showHint, reset, playerColor };
}
