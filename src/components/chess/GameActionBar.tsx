import { Flag, Handshake, X, RotateCcw, Swords, Undo2 } from "lucide-react";

interface Props {
  status: string;
  ply: number;
  rated: boolean;
  isParticipant: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onAbort: () => void;
  onRequestTakeback: () => void;
  onOfferRematch: () => void;
  drawOfferOutgoing: boolean;
  takebackOfferOutgoing: boolean;
}

export function GameActionBar({
  status, ply, rated, isParticipant,
  onResign, onOfferDraw, onAbort, onRequestTakeback, onOfferRematch,
  drawOfferOutgoing, takebackOfferOutgoing,
}: Props) {
  if (!isParticipant) return null;

  if (status === "completed") {
    return (
      <button
        onClick={onOfferRematch}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Swords className="h-4 w-4" /> Offer rematch
      </button>
    );
  }

  if (status !== "active") return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={onResign}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground"
      >
        <Flag className="h-3.5 w-3.5" /> Resign
      </button>
      <button
        onClick={onOfferDraw}
        disabled={drawOfferOutgoing}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
      >
        <Handshake className="h-3.5 w-3.5" /> {drawOfferOutgoing ? "Offer sent" : "Offer draw"}
      </button>
      {ply < 6 && (
        <button
          onClick={onAbort}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" /> Abort
        </button>
      )}
      {!rated && ply > 0 && (
        <button
          onClick={onRequestTakeback}
          disabled={takebackOfferOutgoing}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" /> Takeback
        </button>
      )}
    </div>
  );
}
