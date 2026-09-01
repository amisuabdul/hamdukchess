import { useEffect, useRef, useState } from "react";

/**
 * Lightweight Stockfish evaluation for spectators. Runs a fixed-depth search
 * on every FEN change and reports centipawns from white's perspective.
 */
export function useLiveEval(fen: string, depth = 10, enabled = true) {
  const workerRef = useRef<Worker | null>(null);
  const [cp, setCp] = useState<number | null>(null);
  const [mate, setMate] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const code = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      const score = line.match(/score\s+(cp|mate)\s+(-?\d+)/);
      if (score) {
        const raw = parseInt(score[2], 10);
        // Engine scores are from the side to move; flip for black.
        const sideToMove = fenRef.current.split(" ")[1] === "b" ? -1 : 1;
        if (score[1] === "mate") {
          setMate(raw * sideToMove);
          setCp(null);
        } else {
          setCp(raw * sideToMove);
          setMate(null);
        }
      }
      if (/^bestmove/.test(line)) setThinking(false);
    };
    worker.postMessage("uci");
    worker.postMessage("isready");
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
      workerRef.current = null;
    };
  }, [enabled]);

  const fenRef = useRef(fen);
  useEffect(() => {
    fenRef.current = fen;
    const w = workerRef.current;
    if (!w || !enabled) return;
    setThinking(true);
    w.postMessage("stop");
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  }, [fen, depth, enabled]);

  return { cp, mate, thinking };
}

export function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null) return `#${mate > 0 ? "" : "-"}${Math.abs(mate)}`;
  if (cp === null) return "—";
  const pawns = cp / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
}
