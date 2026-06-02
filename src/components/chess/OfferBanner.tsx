import { useEffect, useState } from "react";

interface Props {
  kind: "draw" | "takeback";
  offeredAt: string;
  ttlMs?: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function OfferBanner({ kind, offeredAt, ttlMs = 30_000, onAccept, onDecline }: Props) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, ttlMs - (Date.now() - new Date(offeredAt).getTime())),
  );
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, ttlMs - (Date.now() - new Date(offeredAt).getTime())));
    }, 250);
    return () => window.clearInterval(id);
  }, [offeredAt, ttlMs]);

  if (remaining <= 0) return null;
  const label = kind === "draw" ? "Draw offered" : "Takeback requested";
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="my-3 flex items-center justify-between rounded-lg border border-primary bg-primary/5 px-4 py-3">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">Expires in {seconds}s</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
