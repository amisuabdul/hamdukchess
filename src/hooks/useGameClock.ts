import { useEffect, useState } from "react";

interface Args {
  whiteMs: number;
  blackMs: number;
  turn: "w" | "b";
  lastUpdate: string | null;
  active: boolean;
}

/**
 * Client-side interpolated clock. Server is the source of truth — these
 * numbers are only for display between server updates.
 */
export function useGameClock({ whiteMs, blackMs, turn, lastUpdate, active }: Args) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [active]);

  const elapsed = active && lastUpdate ? Math.max(0, now - new Date(lastUpdate).getTime()) : 0;
  const w = Math.max(0, turn === "w" ? whiteMs - elapsed : whiteMs);
  const b = Math.max(0, turn === "b" ? blackMs - elapsed : blackMs);
  return { whiteDisplayMs: w, blackDisplayMs: b };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (ms < 10_000) {
    // Show tenths under 10s
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m}:${s.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}
