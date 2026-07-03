import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { sounds } from "@/lib/chess-sounds";
import type { Tutorial, TutorialStep } from "@/lib/tutorials-data";
import { Lightbulb, ChevronRight, RotateCcw, CheckCircle2 } from "lucide-react";

type Props = {
  tutorial: Tutorial;
  initialStep?: number;
  onStepChange?: (index: number) => void;
  onComplete?: () => void;
};

export function TutorialPlayer({ tutorial, initialStep = 0, onStepChange, onComplete }: Props) {
  const clamp = (n: number) => Math.max(0, Math.min(tutorial.steps.length - 1, n));
  const [index, setIndex] = useState<number>(clamp(initialStep));
  const step: TutorialStep = tutorial.steps[index];
  const isMove = step.kind === "move";

  const [fen, setFen] = useState<string>(step.fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hintOn, setHintOn] = useState<boolean>(false);
  const [wrong, setWrong] = useState<boolean>(false);
  const [solved, setSolved] = useState<boolean>(!isMove);
  const [finished, setFinished] = useState<boolean>(false);

  // Reset per step
  useEffect(() => {
    setFen(step.fen);
    setSelected(null);
    setHintOn(false);
    setWrong(false);
    setSolved(step.kind === "observe");
    onStepChange?.(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tutorial.id]);

  const playerColor = useMemo(() => step.fen.split(" ")[1] as "w" | "b", [step.fen]);
  const orientation = playerColor === "w" ? "white" : "black";

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

  const hintSquare = hintOn && isMove ? step.hint ?? step.answer.slice(0, 2) : null;

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) s[selected] = { background: "rgba(245, 166, 35, 0.55)" };
    for (const t of legalTargets) {
      s[t] = {
        background: "radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 25%)",
      };
    }
    if (hintSquare) {
      s[hintSquare] = {
        background: "rgba(245, 166, 35, 0.65)",
        boxShadow: "inset 0 0 0 3px rgba(245,166,35,0.9)",
      };
    }
    return s;
  }, [selected, legalTargets, hintSquare]);

  const attemptMove = (from: Square, to: Square, promotion?: string): boolean => {
    if (!isMove || solved) return false;
    const answer = step.answer;
    const aFrom = answer.slice(0, 2);
    const aTo = answer.slice(2, 4);
    const aPromo = answer[4];
    const match = from === aFrom && to === aTo && (aPromo ? promotion === aPromo : true);

    if (!match) {
      setWrong(true);
      setTimeout(() => setWrong(false), 700);
      return false;
    }

    try {
      const c = new Chess(fen);
      const m = c.move({ from, to, promotion: promotion ?? aPromo ?? "q" });
      if (!m) return false;
      setFen(c.fen());
      setSolved(true);
      sounds.move();
      setSelected(null);
      return true;
    } catch {
      return false;
    }
  };

  const handleDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    return attemptMove(sourceSquare as Square, targetSquare as Square);
  };

  const handleSquareClick = ({ square }: { square: string }) => {
    if (!isMove || solved) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) return setSelected(null);
      if (legalTargets.has(sq)) return void attemptMove(selected, sq);
    }
    try {
      const c = new Chess(fen);
      const piece = c.get(sq);
      if (piece && piece.color === playerColor) setSelected(sq);
      else setSelected(null);
    } catch {
      setSelected(null);
    }
  };

  const goNext = () => {
    if (index >= tutorial.steps.length - 1) {
      setFinished(true);
      onComplete?.();
      sounds.end();
      return;
    }
    setIndex((i) => clamp(i + 1));
  };

  const goPrev = () => setIndex((i) => clamp(i - 1));

  const resetStep = () => {
    setFen(step.fen);
    setSelected(null);
    setSolved(step.kind === "observe");
    setHintOn(false);
    setWrong(false);
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
    allowDragging: isMove && !solved,
    id: "tutorial-board",
  };

  const progressPct = Math.round(((index + (solved ? 1 : 0)) / tutorial.steps.length) * 100);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="space-y-3">
        <div
          className={`relative aspect-square w-full max-w-[560px] mx-auto bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden touch-none select-none transition-shadow ${
            wrong ? "ring-2 ring-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]" : ""
          }`}
        >
          <Chessboard options={options} />
          {solved && isMove && (
            <div className="absolute top-3 left-3 rounded-full bg-emerald-600/90 text-white text-xs px-3 py-1 shadow flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Correct
            </div>
          )}
        </div>

        <div className="mx-auto max-w-[560px] flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-black/10 bg-panel hover:bg-zinc-100 disabled:opacity-40"
          >
            Back
          </button>
          <button
            onClick={resetStep}
            className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-black/10 bg-panel hover:bg-zinc-100 inline-flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          {isMove && !solved && (
            <button
              onClick={() => setHintOn(true)}
              className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-amber-400/60 bg-amber-50 text-amber-900 hover:bg-amber-100 inline-flex items-center gap-1"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Hint
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={goNext}
            disabled={isMove && !solved}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 inline-flex items-center gap-1"
          >
            {index === tutorial.steps.length - 1 ? "Finish" : "Next"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {index + 1} of {tutorial.steps.length}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{step.body}</p>
          {isMove && !solved && (
            <p className="mt-3 text-xs uppercase tracking-wider text-amber-700">
              Your move — {playerColor === "w" ? "White" : "Black"} to play
            </p>
          )}
          {wrong && (
            <p className="mt-2 text-xs text-red-600">Not quite — try another move.</p>
          )}
        </div>

        {finished && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Lesson complete!</p>
            <p className="mt-1 text-emerald-800/80">
              Nice work. Pick another module from the Learn page to keep going.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
