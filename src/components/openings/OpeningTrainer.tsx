import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { sounds } from "@/lib/chess-sounds";
import type { OpeningLine } from "@/lib/openings-data";
import { Lightbulb, RotateCcw, CheckCircle2, ChevronLeft, Flag } from "lucide-react";

type Props = {
  opening: OpeningLine;
  onSessionComplete: (result: {
    correct: number;
    attempts: number;
    masteredDepth: number;
  }) => void;
};

// Trainer mechanic:
// - Board plays through the opening line move-by-move.
// - When it's the user's colour to move (opening.color), they must play the correct UCI move.
// - When it's the opposite colour, the app plays the book move automatically.
// - Wrong moves count as attempts but don't halt the session (up to 3 wrong per node before revealing).
export function OpeningTrainer({ opening, onSessionComplete }: Props) {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const [ply, setPly] = useState(0); // index into opening.moves
  const [fen, setFen] = useState(startFen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hintOn, setHintOn] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [session, setSession] = useState({ correct: 0, attempts: 0 });
  const [done, setDone] = useState(false);

  const orientation = opening.color;

  // Whose turn is it based on ply (even = white, odd = black)?
  const sideToMove: "white" | "black" = ply % 2 === 0 ? "white" : "black";
  const isUserTurn = sideToMove === opening.color;
  const currentMove = opening.moves[ply];

  const finish = useCallback(
    (finalPly: number, correct: number, attempts: number) => {
      setDone(true);
      sounds.end();
      onSessionComplete({ correct, attempts, masteredDepth: finalPly });
    },
    [onSessionComplete],
  );

  // Auto-play book moves for the opponent side.
  useEffect(() => {
    if (done) return;
    if (ply >= opening.moves.length) {
      finish(ply, session.correct, session.attempts);
      return;
    }
    if (isUserTurn) return;
    const timer = setTimeout(() => {
      try {
        const c = new Chess(fen);
        const from = currentMove.slice(0, 2);
        const to = currentMove.slice(2, 4);
        const promo = currentMove[4];
        const m = c.move({ from, to, promotion: promo ?? "q" });
        if (m) {
          setFen(c.fen());
          sounds.move();
          setPly((p) => p + 1);
          setWrongCount(0);
          setHintOn(false);
        }
      } catch {
        /* ignore */
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [ply, isUserTurn, currentMove, fen, opening.moves.length, done, finish, session.correct, session.attempts]);

  const legalTargets = useMemo<Set<string>>(() => {
    if (!selected || !isUserTurn || done) return new Set();
    try {
      const c = new Chess(fen);
      const moves = c.moves({ square: selected, verbose: true });
      return new Set(moves.map((m: { to: string }) => m.to));
    } catch {
      return new Set();
    }
  }, [selected, fen, isUserTurn, done]);

  const hintSquare = hintOn && isUserTurn && !done ? currentMove?.slice(0, 2) : null;

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) s[selected] = { background: "rgba(245, 166, 35, 0.55)" };
    for (const t of legalTargets) {
      s[t] = { background: "radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 25%)" };
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
    if (!isUserTurn || done) return false;
    const answer = currentMove;
    const aFrom = answer.slice(0, 2);
    const aTo = answer.slice(2, 4);
    const aPromo = answer[4];
    const match = from === aFrom && to === aTo && (aPromo ? promotion === aPromo : true);

    setSession((s) => ({ ...s, attempts: s.attempts + 1 }));

    if (!match) {
      setWrong(true);
      setTimeout(() => setWrong(false), 700);
      setWrongCount((n) => n + 1);
      return false;
    }

    try {
      const c = new Chess(fen);
      const m = c.move({ from, to, promotion: promotion ?? aPromo ?? "q" });
      if (!m) return false;
      setFen(c.fen());
      sounds.move();
      setSelected(null);
      setHintOn(false);
      setWrongCount(0);
      setSession((s) => ({ ...s, correct: s.correct + 1 }));
      setPly((p) => p + 1);
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
    if (!isUserTurn || done) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) return setSelected(null);
      if (legalTargets.has(sq)) return void attemptMove(selected, sq);
    }
    try {
      const c = new Chess(fen);
      const piece = c.get(sq);
      const colorChar = opening.color === "white" ? "w" : "b";
      if (piece && piece.color === colorChar) setSelected(sq);
      else setSelected(null);
    } catch {
      setSelected(null);
    }
  };

  const restart = () => {
    setPly(0);
    setFen(startFen);
    setSelected(null);
    setHintOn(false);
    setWrong(false);
    setWrongCount(0);
    setSession({ correct: 0, attempts: 0 });
    setDone(false);
  };

  const giveUp = () => {
    finish(ply, session.correct, session.attempts);
  };

  const options = {
    position: fen,
    onPieceDrop: handleDrop,
    onSquareClick: handleSquareClick,
    boardOrientation: orientation,
    squareStyles,
    darkSquareStyle: { backgroundColor: "#b58863" },
    lightSquareStyle: { backgroundColor: "#f0d9b5" },
    animationDurationInMs: 200,
    allowDragging: isUserTurn && !done,
    id: "opening-board",
  };

  const progressPct = Math.round((ply / opening.moves.length) * 100);
  const accuracy = session.attempts > 0 ? Math.round((session.correct / session.attempts) * 100) : 100;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div
          className={`relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-sm bg-zinc-300 ring-1 ring-black/10 transition-shadow ${
            wrong ? "ring-2 ring-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]" : ""
          }`}
        >
          <Chessboard options={options} />
          {done && (
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3 py-1 text-xs text-white shadow">
              <CheckCircle2 className="h-3.5 w-3.5" /> Session complete
            </div>
          )}
        </div>

        <div className="mx-auto flex max-w-[560px] items-center gap-3">
          <button
            onClick={restart}
            className="inline-flex items-center gap-1 rounded bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-black/10 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
          {isUserTurn && !done && (
            <button
              onClick={() => setHintOn(true)}
              className="inline-flex items-center gap-1 rounded bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-400/60 hover:bg-amber-100"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Hint {wrongCount >= 2 ? "(shown)" : ""}
            </button>
          )}
          <div className="flex-1" />
          {!done && (
            <button
              onClick={giveUp}
              className="inline-flex items-center gap-1 rounded bg-panel px-3 py-1.5 text-xs font-medium ring-1 ring-black/10 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Flag className="h-3.5 w-3.5" /> End session
            </button>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Move {Math.min(ply + 1, opening.moves.length)} of {opening.moves.length}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {opening.eco} · Playing {opening.color}
            </p>
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {session.correct}/{session.attempts} ({accuracy}%)
            </p>
          </div>
          <h2 className="mt-1 font-serif text-xl font-semibold text-foreground">{opening.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{opening.description}</p>
          {isUserTurn && !done && (
            <p className="mt-3 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Your move — {opening.color === "white" ? "White" : "Black"} to play
            </p>
          )}
          {!isUserTurn && !done && (
            <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
              Opponent is playing the book move…
            </p>
          )}
          {wrong && !done && (
            <p className="mt-2 text-xs text-red-600">Not the book move — try again.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Key ideas</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
            {opening.ideas.map((idea) => (
              <li key={idea} className="flex gap-2">
                <ChevronLeft className="mt-1 h-3 w-3 rotate-180 shrink-0 text-primary" />
                <span>{idea}</span>
              </li>
            ))}
          </ul>
        </div>

        {done && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
            <p className="font-semibold">Session recorded</p>
            <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
              Reached move {ply} of {opening.moves.length} · {accuracy}% accuracy.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
