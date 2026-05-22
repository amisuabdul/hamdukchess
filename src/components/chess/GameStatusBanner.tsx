import type { GameStatus } from "@/hooks/useChessGame";

export function GameStatusBanner({ status, onNewGame }: { status: GameStatus; onNewGame: () => void }) {
  if (status.kind === "active" || status.kind === "check") return null;

  let title = "";
  let subtitle = "";
  if (status.kind === "checkmate") {
    title = "Checkmate";
    subtitle = `${status.winner === "w" ? "White" : "Black"} wins`;
  } else if (status.kind === "stalemate") {
    title = "Stalemate";
    subtitle = "Draw";
  } else if (status.kind === "draw") {
    title = "Draw";
    subtitle = status.reason;
  } else if (status.kind === "resigned") {
    title = "Resignation";
    subtitle = `${status.winner === "w" ? "White" : "Black"} wins`;
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-sm">
      <div className="bg-panel rounded-lg ring-1 ring-black/10 px-8 py-6 text-center shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400 mb-2">{subtitle}</p>
        <h3 className="text-3xl font-semibold mb-4">{title}</h3>
        <button
          onClick={onNewGame}
          className="px-5 py-2 bg-zinc-900 text-zinc-100 rounded text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
