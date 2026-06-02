import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

interface Props {
  disconnectedAt: string;
  graceMs?: number;
  onClaimWin: () => void;
}

export function DisconnectBanner({ disconnectedAt, graceMs = 30_000, onClaimWin }: Props) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, graceMs - (Date.now() - new Date(disconnectedAt).getTime())),
  );
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, graceMs - (Date.now() - new Date(disconnectedAt).getTime())));
    }, 250);
    return () => window.clearInterval(id);
  }, [disconnectedAt, graceMs]);

  useEffect(() => {
    if (remaining === 0 && !claimed) {
      setClaimed(true);
      onClaimWin();
    }
  }, [remaining, claimed, onClaimWin]);

  return (
    <div className="my-3 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
      <WifiOff className="h-4 w-4 text-destructive" />
      <div className="flex-1">
        <p className="font-semibold">Opponent disconnected</p>
        <p className="text-xs text-muted-foreground">
          Waiting {Math.ceil(remaining / 1000)}s for them to reconnect…
        </p>
      </div>
    </div>
  );
}
