import { useEffect, useRef } from "react";

type BestMoveCb = (uci: string) => void;

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const cbRef = useRef<BestMoveCb | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      const match = line.match(/^bestmove\s+(\S+)/);
      if (match && cbRef.current) {
        const cb = cbRef.current;
        cbRef.current = null;
        cb(match[1]);
      }
    };

    worker.postMessage("uci");
    worker.postMessage("isready");

    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
      workerRef.current = null;
    };
  }, []);

  const requestMove = (fen: string, skill: number, movetimeMs: number, cb: BestMoveCb) => {
    const w = workerRef.current;
    if (!w) return;
    cbRef.current = cb;
    w.postMessage(`setoption name Skill Level value ${skill}`);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${movetimeMs}`);
  };

  return { requestMove };
}
