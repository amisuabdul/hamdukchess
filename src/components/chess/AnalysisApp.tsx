import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useReplay } from "@/hooks/useReplay";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { ReplayMoveList } from "./ReplayMoveList";
import { AnalysisToolbar } from "./AnalysisToolbar";
import { PgnImportDialog } from "./PgnImportDialog";
import { FenImportDialog } from "./FenImportDialog";
import { AiCoachPanel } from "./AiCoachPanel";
import { downloadPgn, exportPgn } from "@/lib/pgn";

export function AnalysisApp() {
  const replay = useReplay();
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [pgnOpen, setPgnOpen] = useState(false);
  const [fenOpen, setFenOpen] = useState(false);

  useKeyboardNav({
    onPrev: replay.prev,
    onNext: replay.next,
    onStart: replay.toStart,
    onEnd: replay.toEnd,
  });

  // Hand-off from /
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stash = sessionStorage.getItem("analysis:pgn");
    if (stash) {
      sessionStorage.removeItem("analysis:pgn");
      try {
        replay.loadPgnText(stash);
        toast.success("Game loaded from board.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load game.");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastMoveSquares = useMemo(() => {
    if (replay.ply === 0) return null;
    const m = replay.moves[replay.ply - 1];
    return m ? { from: m.from, to: m.to } : null;
  }, [replay.ply, replay.moves]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMoveSquares) {
      styles[lastMoveSquares.from] = { background: "rgba(250, 204, 21, 0.25)" };
      styles[lastMoveSquares.to] = { background: "rgba(250, 204, 21, 0.35)" };
    }
    return styles;
  }, [lastMoveSquares]);

  const boardOptions = useMemo(
    () => ({
      position: replay.fen,
      boardOrientation: orientation,
      squareStyles,
      darkSquareStyle: { backgroundColor: "#a8a29e" },
      lightSquareStyle: { backgroundColor: "#e7e5e4" },
      animationDurationInMs: 180,
      allowDragging: false,
      id: "analysis-board",
    }),
    [replay.fen, orientation, squareStyles],
  );

  const currentPgn = useMemo(
    () => exportPgn(replay.headers, replay.moves),
    [replay.headers, replay.moves],
  );

  const handleExport = useCallback(() => {
    if (replay.moves.length === 0) return;
    downloadPgn(currentPgn, "analysis.pgn");
    toast.success("PGN downloaded.");
  }, [currentPgn, replay.moves.length]);

  const handleCopyFen = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(replay.fen);
      toast.success("FEN copied.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [replay.fen]);

  const handleLoadPgn = useCallback(
    (pgn: string) => {
      replay.loadPgnText(pgn);
      toast.success("PGN loaded.");
    },
    [replay],
  );

  const handleLoadFen = useCallback(
    (fen: string) => {
      replay.loadFenText(fen);
      toast.success("Position loaded.");
    },
    [replay],
  );

  return (
    <div className="min-h-screen bg-surface font-sans text-zinc-900">
      <nav className="h-12 border-b border-zinc-950/5 flex items-center justify-between px-6 bg-panel">
        <div className="flex items-center gap-6">
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
            Analysis Studio
          </span>
          <div className="h-4 w-px bg-zinc-950/5" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-700">
            Ply {replay.ply} / {replay.moves.length}
          </span>
        </div>
        <Link
          to="/"
          className="text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-900"
        >
          ← Back to board
        </Link>
      </nav>

      <main className="max-w-[1440px] mx-auto px-6 md:px-12 py-8 md:py-12 flex flex-col lg:flex-row gap-8 md:gap-12 items-start">
        <div className="flex-1 flex flex-col items-center w-full">
          <div className="w-full max-w-[720px] space-y-4">
            <AnalysisToolbar
              onImportPgn={() => setPgnOpen(true)}
              onImportFen={() => setFenOpen(true)}
              onExportPgn={handleExport}
              onCopyFen={handleCopyFen}
              onFlip={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
              onReset={replay.reset}
              hasMoves={replay.moves.length > 0}
            />

            <div className="relative aspect-square w-full bg-zinc-300 ring-1 ring-black/10 rounded-sm overflow-hidden">
              <Chessboard options={boardOptions} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={replay.toStart}
                disabled={replay.isStart}
                className="flex-1 py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                aria-label="Jump to start"
              >
                ⏮
              </button>
              <button
                onClick={replay.prev}
                disabled={replay.isStart}
                className="flex-1 py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                aria-label="Previous move"
              >
                ◀
              </button>
              <button
                onClick={replay.next}
                disabled={replay.isEnd}
                className="flex-1 py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                aria-label="Next move"
              >
                ▶
              </button>
              <button
                onClick={replay.toEnd}
                disabled={replay.isEnd}
                className="flex-1 py-2 px-3 text-sm font-medium bg-panel text-zinc-700 rounded ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                aria-label="Jump to end"
              >
                ⏭
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 text-center">
              Use ← / → to step, ↑ / ↓ to jump to start / end.
            </p>
          </div>
        </div>

        <aside className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
          <ReplayMoveList moves={replay.moves} ply={replay.ply} onSelect={replay.setPly} />
          <AiCoachPanel
            fen={replay.fen}
            turn={replay.turn}
            pgn={currentPgn}
            hasMoves={replay.moves.length > 0}
          />
        </aside>
      </main>

      <PgnImportDialog open={pgnOpen} onOpenChange={setPgnOpen} onLoad={handleLoadPgn} />
      <FenImportDialog open={fenOpen} onOpenChange={setFenOpen} onLoad={handleLoadFen} />
    </div>
  );
}
