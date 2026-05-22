import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import { useNavigate } from "@tanstack/react-router";
import { useChessGame } from "@/hooks/useChessGame";
import { useStockfish } from "@/hooks/useStockfish";
import { sounds } from "@/lib/chess-sounds";
import { MoveList } from "./MoveList";
import { CapturedStrip } from "./CapturedPieces";
import { PromotionDialog } from "./PromotionDialog";
import { GameStatusBanner } from "./GameStatusBanner";

type Mode = "human" | "engine";

export function ChessApp() {
  const game = useChessGame();
  const { requestMove } = useStockfish();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("human");
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: Square; to: Square } | null>(null);
  const engineThinking = useRef(false);

  // Engine plays as black when mode === "engine"
  const engineColor: Color = "b";

  const playWithSound = useCallback(
    (from: Square, to: Square, promo?: PieceSymbol) => {
      const move = game.makeMove(from, to, promo);
      if (!move) return false;
      if (move.flags.includes("c") || move.flags.includes("e")) sounds.capture();
      else sounds.move();
      // Status sounds after re-render
      setTimeout(() => {
        // game.status is stale here; rely on chess.js side-effects via setTimeout poll
      }, 0);
      return true;
    },
    [game],
  );

  // Sound on check/end based on status changes
  const lastStatusKind = useRef(game.status.kind);
  useEffect(() => {
    if (game.status.kind !== lastStatusKind.current) {
      if (game.status.kind === "check") sounds.check();
      if (
        game.status.kind === "checkmate" ||
        game.status.kind === "stalemate" ||
        game.status.kind === "draw" ||
        game.status.kind === "resigned"
      ) sounds.end();
      lastStatusKind.current = game.status.kind;
    }
  }, [game.status]);

  // Engine move
  useEffect(() => {
    if (mode !== "engine" || game.gameOver) return;
    if (game.turn !== engineColor) return;
    if (engineThinking.current) return;
    engineThinking.current = true;
    const timer = setTimeout(() => {
      requestMove(game.fen, 8, 600, (uci) => {
        engineThinking.current = false;
        if (!uci || uci === "(none)") return;
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promo = (uci[4] as PieceSymbol | undefined) ?? undefined;
        playWithSound(from, to, promo);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      engineThinking.current = false;
    };
  }, [mode, game.turn, game.fen, game.gameOver, requestMove, playWithSound]);

  const legalTargets = useMemo<Square[]>(
    () => (selected ? game.legalMovesFor(selected) : []),
    [selected, game],
  );

  const isPromotion = (from: Square, to: Square): boolean => {
    const piece = from && to ? null : null;
    void piece;
    // Look at current FEN — find piece at `from`
    const fenBoard = game.fen.split(" ")[0];
    const ranks = fenBoard.split("/");
    const fileIdx = from.charCodeAt(0) - "a".charCodeAt(0);
    const rankIdx = 8 - parseInt(from[1]);
    let p: string | null = null;
    let col = 0;
    for (const ch of ranks[rankIdx]) {
      if (/\d/.test(ch)) col += parseInt(ch);
      else {
        if (col === fileIdx) { p = ch; break; }
        col++;
      }
    }
    if (!p || p.toLowerCase() !== "p") return false;
    const toRank = parseInt(to[1]);
    return (p === "P" && toRank === 8) || (p === "p" && toRank === 1);
  };

  const tryMove = (from: Square, to: Square): boolean => {
    if (from === to) return false;
    if (mode === "engine" && game.turn === engineColor) return false;
    if (isPromotion(from, to)) {
      // verify it's a legal target first
      if (!game.legalMovesFor(from).includes(to)) return false;
      setPendingPromo({ from, to });
      return true;
    }
    const ok = playWithSound(from, to);
    if (ok) setSelected(null);
    return ok;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    return tryMove(sourceSquare as Square, targetSquare as Square);
  };

  const onSquareClick = ({ square }: { square: string }) => {
    const sq = square as Square;
    if (selected) {
      if (sq === selected) { setSelected(null); return; }
      if (legalTargets.includes(sq)) { tryMove(selected, sq); return; }
    }
    // Select only own piece
    const board = game.fen.split(" ")[0];
    const ranks = board.split("/");
    const fileIdx = sq.charCodeAt(0) - "a".charCodeAt(0);
    const rankIdx = 8 - parseInt(sq[1]);
    let p: string | null = null;
    let col = 0;
    for (const ch of ranks[rankIdx]) {
      if (/\d/.test(ch)) col += parseInt(ch);
      else { if (col === fileIdx) { p = ch; break; } col++; }
    }
    if (!p) { setSelected(null); return; }
    const pieceColor: Color = p === p.toUpperCase() ? "w" : "b";
    if (pieceColor !== game.turn) { setSelected(null); return; }
    if (mode === "engine" && pieceColor === engineColor) return;
    setSelected(sq);
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selected) {
      styles[selected] = { background: "rgba(234, 179, 8, 0.35)" };
      for (const t of legalTargets) {
        styles[t] = {
          background:
            "radial-gradient(circle, rgba(24,24,27,0.35) 22%, transparent 24%)",
        };
      }
    }
    if (game.lastMove) {
      styles[game.lastMove.from] = { ...styles[game.lastMove.from], background: "rgba(250, 204, 21, 0.25)" };
      styles[game.lastMove.to] = { ...styles[game.lastMove.to], background: "rgba(250, 204, 21, 0.35)" };
    }
    return styles;
  }, [selected, legalTargets, game.lastMove]);

  const boardOptions = useMemo(
    () => ({
      position: game.fen,
      onPieceDrop,
      onSquareClick,
      boardOrientation: orientation,
      squareStyles,
      darkSquareStyle: { backgroundColor: "#a8a29e" },
      lightSquareStyle: { backgroundColor: "#e7e5e4" },
      animationDurationInMs: 180,
      allowDragging: !game.gameOver,
      id: "main-board",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.fen, orientation, squareStyles, game.gameOver],
  );

  const handleNewGame = () => { game.reset(); setSelected(null); setPendingPromo(null); };
  const handleUndo = () => {
    game.undo();
    if (mode === "engine") game.undo(); // undo engine reply too
    setSelected(null);
  };
  const handleFlip = () => setOrientation((o) => (o === "white" ? "black" : "white"));
  const handleResign = () => {
    if (game.gameOver) return;
    game.resign(mode === "engine" ? "w" : game.turn);
  };
  const handleOpenInAnalysis = () => {
    const chess = new Chess();
    for (const m of game.history) {
      chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    sessionStorage.setItem("analysis:pgn", chess.pgn());
    navigate({ to: "/analysis" });
  };

  const turnLabel = game.gameOver
    ? "Game over"
    : game.turn === "w" ? "White to move" : "Black to move";

  return (
    <div className="min-h-screen bg-surface font-sans text-zinc-900 selection:bg-zinc-200">
      <nav className="h-12 border-b border-zinc-950/5 flex items-center justify-between px-6 bg-panel">
        <div className="flex items-center gap-6">
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
            Grandmaster Series // 04
          </span>
          <div className="h-4 w-px bg-zinc-950/5" />
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-700">{turnLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-200/50 p-0.5 rounded-md">
            <button
              onClick={() => setMode("human")}
              className={
                "px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors " +
                (mode === "human" ? "bg-panel shadow-sm ring-1 ring-black/5" : "text-zinc-500 hover:text-zinc-700")
              }
            >
              vs Human
            </button>
            <button
              onClick={() => setMode("engine")}
              className={
                "px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors " +
                (mode === "engine" ? "bg-panel shadow-sm ring-1 ring-black/5" : "text-zinc-500 hover:text-zinc-700")
              }
            >
              vs Engine
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-6 md:px-12 py-8 md:py-12 flex flex-col lg:flex-row gap-8 md:gap-12 items-start">
        <div className="flex-1 flex flex-col items-center w-full">
          <div className="w-full max-w-[720px] space-y-6">
            <PlayerStrip
              name={mode === "engine" ? "Stockfish" : "Black"}
              sub={mode === "engine" ? "Engine · Skill 8" : "Player 2"}
              active={game.turn === "b" && !game.gameOver}
              variant="opponent"
              captured={<CapturedStrip color="w" pieces={game.captured.w} advantage={Math.max(0, -game.advantage)} />}
            />

            <div className="relative aspect-square w-full bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden">
              <Chessboard options={boardOptions} />
              <GameStatusBanner status={game.status} onNewGame={handleNewGame} />
            </div>

            <PlayerStrip
              name="You"
              sub="White · Local"
              active={game.turn === "w" && !game.gameOver}
              variant="self"
              captured={<CapturedStrip color="b" pieces={game.captured.b} advantage={Math.max(0, game.advantage)} />}
            />
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
          <MoveList history={game.history} />

          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleNewGame} className="py-2 px-3 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer">
              New Game
            </button>
            <button onClick={handleUndo} disabled={game.history.length === 0} className="py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              Undo
            </button>
            <button onClick={handleFlip} className="py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 transition-colors cursor-pointer">
              Flip
            </button>
            <button onClick={handleResign} disabled={game.gameOver} className="py-2 px-3 text-sm font-medium bg-panel text-red-700 rounded ring-1 ring-black/5 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              Resign
            </button>
          </div>

          <button
            onClick={handleOpenInAnalysis}
            className="py-2 px-3 text-sm font-medium bg-panel text-zinc-900 rounded ring-1 ring-black/10 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Open in Analysis →
          </button>

          <p className="text-xs text-zinc-400 leading-normal max-w-[32ch] text-pretty">
            {mode === "engine"
              ? "Playing Stockfish at skill level 8. The engine moves after a brief delay."
              : "Hot-seat mode. Two players share the board — flip after each move if needed."}
          </p>
        </aside>
      </main>

      {pendingPromo && (
        <PromotionDialog
          color={game.turn}
          onCancel={() => setPendingPromo(null)}
          onPick={(p) => {
            const { from, to } = pendingPromo;
            setPendingPromo(null);
            playWithSound(from, to, p);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function PlayerStrip({
  name,
  sub,
  active,
  variant,
  captured,
}: {
  name: string;
  sub: string;
  active: boolean;
  variant: "opponent" | "self";
  captured: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={
            "size-10 rounded-sm flex items-center justify-center text-xs font-medium " +
            (variant === "self"
              ? "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-900"
              : "bg-zinc-200 text-zinc-500 ring-1 ring-black/5")
          }
        >
          {variant === "self" ? "ME" : "OP"}
        </div>
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            {name}
            {active && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </p>
          <p className="text-[11px] text-zinc-500 uppercase tracking-tight">{sub}</p>
        </div>
      </div>
      <div className="flex-1 mx-4 hidden sm:block">{captured}</div>
    </div>
  );
}
