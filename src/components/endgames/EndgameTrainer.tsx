import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import { useStockfish } from "@/hooks/useStockfish";
import { sounds } from "@/lib/chess-sounds";
import type { EndgamePosition } from "@/lib/endgames-data";
import { Lightbulb, RotateCcw, Trophy, Flag, CheckCircle2 } from "lucide-react";

type Outcome = "won" | "lost" | "drawn" | "playing";

type Props = {
  endgame: EndgamePosition;
  onFinished?: (result: { completed: boolean; moveCount: number }) => void;
};

export function EndgameTrainer({ endgame, onFinished }: Props) {
  const { requestMove } = useStockfish();
  const chessRef = useRef(new Chess(endgame.fen));
  const [fen, setFen] = useState<string>(endgame.fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("playing");
  const [thinking, setThinking] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const reportedRef = useRef(false);

  const userColor: "w" | "b" = endgame.userColor === "white" ? "w" : "b";

  const finish = useCallback(
    (result: Outcome, moves: number) => {
      if (reportedRef.current) return;
      reportedRef.current = true;
      setOutcome(result);
      const completed = result === "won" || (endgame.goal.kind === "draw" && result === "drawn");
      onFinished?.({ completed, moveCount: moves });
      if (completed) sounds.end();
    },
    [endgame.goal.kind, onFinished],
  );

  const evaluate = useCallback(
    (chess: Chess, moves: number) => {
      // Terminal states
      if (chess.isCheckmate()) {
        // side to move is checkmated → the other side won
        const winner: "w" | "b" = chess.turn() === "w" ? "b" : "w";
        if (endgame.goal.kind === "mate" && winner === userColor) return finish("won", moves);
        return finish("lost", moves);
      }
      if (chess.isStalemate() || chess.isInsufficientMaterial() || chess.isDraw()) {
        if (endgame.goal.kind === "draw") return finish("won", moves);
        return finish("drawn", moves);
      }
      // Promotion goal: did user just promote?
      if (endgame.goal.kind === "promote") {
        const history = chess.history({ verbose: true });
        const last = history[history.length - 1];
        if (last && last.color === userColor && last.promotion) {
          return finish("won", moves);
        }
      }
      // Move budget exceeded
      if (moves >= endgame.goal.maxMoves) {
        if (endgame.goal.kind === "draw") return finish("won", moves);
        return finish("lost", moves);
      }
    },
    [endgame.goal, userColor, finish],
  );

  const engineTurn = useCallback(
    (currentFen: string, moves: number) => {
      setThinking(true);
      requestMove(currentFen, 20, 500, (uci) => {
        setThinking(false);
        const c = chessRef.current;
        try {
          const from = uci.slice(0, 2) as Square;
          const to = uci.slice(2, 4) as Square;
          const promotion = uci[4] as "q" | "r" | "b" | "n" | undefined;
          const m = c.move({ from, to, promotion: promotion ?? "q" });
          if (!m) return;
          setFen(c.fen());
          sounds.move();
          evaluate(c, moves);
        } catch {
          /* noop */
        }
      });
    },
    [requestMove, evaluate],
  );

  // Reset when endgame changes
  useEffect(() => {
    chessRef.current = new Chess(endgame.fen);
    setFen(endgame.fen);
    setSelected(null);
    setMoveCount(0);
    setOutcome("playing");
    setHintOn(false);
    setHintSquare(null);
    reportedRef.current = false;
    // If engine is on move first (shouldn't be, our FENs put user first) — trigger it.
    if (chessRef.current.turn() !== userColor) {
      engineTurn(endgame.fen, 0);
    }
  }, [endgame.id, endgame.fen, userColor, engineTurn]);

  const legalTargets = useMemo<Set<string>>(() => {
    if (!selected) return new Set();
    try {
      const moves = chessRef.current.moves({ square: selected, verbose: true });
      return new Set(moves.map((m: { to: string }) => m.to));
    } catch {
      return new Set();
    }
  }, [selected, fen]);

  const attemptMove = (from: Square, to: Square, promotion: string = "q"): boolean => {
    if (outcome !== "playing" || thinking) return false;
    const c = chessRef.current;
    if (c.turn() !== userColor) return false;
    try {
      const m = c.move({ from, to, promotion });
      if (!m) return false;
      const nextMoves = moveCount + 1;
      setMoveCount(nextMoves);
      setFen(c.fen());
      setSelected(null);
      setHintOn(false);
      setHintSquare(null);
      sounds.move();
      // Evaluate after user's move
      evaluate(c, nextMoves);
      if (reportedRef.current) return true;
      // Engine reply
      setTimeout(() => engineTurn(c.fen(), nextMoves), 250);
      return true;
    } catch {
      return false;
    }
  };

  const requestHint = () => {
    if (outcome !== "playing" || thinking) return;
    setHintOn(true);
    setThinking(true);
    requestMove(chessRef.current.fen(), 20, 400, (uci) => {
      setThinking(false);
      setHintSquare(uci.slice(0, 2));
    });
  };

  const resetPosition = () => {
    chessRef.current = new Chess(endgame.fen);
    setFen(endgame.fen);
    setSelected(null);
    setMoveCount(0);
    setOutcome("playing");
    setHintOn(false);
    setHintSquare(null);
    reportedRef.current = false;
  };

  const resign = () => {
    if (outcome !== "playing") return;
    finish("lost", moveCount);
  };

  const handleDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (!targetSquare) return false;
    return attemptMove(sourceSquare as Square, targetSquare as Square);
  };

  const handleSquareClick = ({ square }: { square: string }) => {
    if (outcome !== "playing" || thinking) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) return setSelected(null);
      if (legalTargets.has(sq)) return void attemptMove(selected, sq);
    }
    const piece = chessRef.current.get(sq);
    if (piece && piece.color === userColor) setSelected(sq);
    else setSelected(null);
  };

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (selected) s[selected] = { background: "rgba(245, 166, 35, 0.55)" };
    for (const t of legalTargets) {
      s[t] = { background: "radial-gradient(circle, rgba(20,20,20,0.35) 22%, transparent 25%)" };
    }
    if (hintOn && hintSquare) {
      s[hintSquare] = {
        background: "rgba(245, 166, 35, 0.65)",
        boxShadow: "inset 0 0 0 3px rgba(245,166,35,0.9)",
      };
    }
    return s;
  }, [selected, legalTargets, hintOn, hintSquare]);

  const options = {
    position: fen,
    onPieceDrop: handleDrop,
    onSquareClick: handleSquareClick,
    boardOrientation: endgame.userColor,
    squareStyles,
    darkSquareStyle: { backgroundColor: "#b58863" },
    lightSquareStyle: { backgroundColor: "#f0d9b5" },
    animationDurationInMs: 200,
    allowDragging: outcome === "playing" && !thinking,
    id: "endgame-board",
  };

  const goalLabel =
    endgame.goal.kind === "mate"
      ? `Mate in ≤ ${endgame.goal.maxMoves} moves`
      : endgame.goal.kind === "promote"
        ? `Promote a pawn in ≤ ${endgame.goal.maxMoves} moves`
        : `Hold the draw for ${endgame.goal.maxMoves} moves`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="space-y-3">
        <div className="relative aspect-square w-full max-w-[560px] mx-auto bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden touch-none select-none">
          <Chessboard options={options} />
          {thinking && (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/70 text-white text-xs px-3 py-1">
              Engine thinking…
            </div>
          )}
          {outcome === "won" && (
            <div className="absolute top-3 left-3 rounded-full bg-emerald-600/90 text-white text-xs px-3 py-1 shadow flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Solved
            </div>
          )}
          {(outcome === "lost" || outcome === "drawn") && (
            <div className="absolute top-3 left-3 rounded-full bg-red-600/90 text-white text-xs px-3 py-1 shadow">
              {outcome === "drawn" ? "Drawn — goal not met" : "Position lost"}
            </div>
          )}
        </div>

        <div className="mx-auto max-w-[560px] flex items-center gap-3">
          <button
            onClick={resetPosition}
            className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-black/10 bg-panel hover:bg-zinc-100 inline-flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </button>
          <button
            onClick={requestHint}
            disabled={outcome !== "playing" || thinking}
            className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-amber-400/60 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Lightbulb className="h-3.5 w-3.5" /> Hint
          </button>
          <div className="flex-1" />
          <button
            onClick={resign}
            disabled={outcome !== "playing"}
            className="px-3 py-1.5 text-xs font-medium rounded ring-1 ring-red-400/60 bg-red-50 text-red-900 hover:bg-red-100 disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Flag className="h-3.5 w-3.5" /> Give up
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">{endgame.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{endgame.description}</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-semibold text-foreground">Goal:</span>
            <span className="text-foreground/80">{goalLabel}</span>
          </div>
          {endgame.hint && (
            <p className="mt-2 text-xs text-muted-foreground italic">Tip: {endgame.hint}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Moves played</span>
            <span className="font-semibold text-foreground">
              {moveCount} / {endgame.goal.maxMoves}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (moveCount / endgame.goal.maxMoves) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Playing as</span>
            <span className="font-medium text-foreground capitalize">{endgame.userColor}</span>
          </div>
        </div>

        {outcome === "won" && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Well done!</p>
            <p className="mt-1 text-emerald-800/80">
              Solved in {moveCount} move{moveCount === 1 ? "" : "s"}. Restart to try to improve, or pick another endgame.
            </p>
          </div>
        )}
        {(outcome === "lost" || outcome === "drawn") && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">Not this time.</p>
            <p className="mt-1 text-red-800/80">
              Restart the position and study the goal — hints show the best first square.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
