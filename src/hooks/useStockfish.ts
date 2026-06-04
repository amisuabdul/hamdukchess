import { useEffect, useRef } from "react";
import { pickDepth, pickFromPvs, type BotMoveOpts, type Pv } from "@/lib/bot-engine";

type BestMoveCb = (uci: string) => void;

export type { BotMoveOpts };

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const cbRef = useRef<BestMoveCb | null>(null);
  const modeRef = useRef<"single" | "multi">("single");
  const pvsRef = useRef<Pv[]>([]);
  const optsRef = useRef<BotMoveOpts | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";

      if (modeRef.current === "multi") {
        const mpv = line.match(/multipv\s+(\d+)/);
        const score = line.match(/score\s+(cp|mate)\s+(-?\d+)/);
        const pv = line.match(/\spv\s+(\S+)/);
        if (mpv && score && pv) {
          const idx = parseInt(mpv[1], 10) - 1;
          const raw = parseInt(score[2], 10);
          const cp = score[1] === "mate" ? Math.sign(raw) * 100000 : raw;
          pvsRef.current[idx] = { move: pv[1], score: cp };
        }
      }

      const bm = line.match(/^bestmove\s+(\S+)/);
      if (bm && cbRef.current) {
        let chosen = bm[1];
        if (modeRef.current === "multi" && optsRef.current) {
          chosen = pickFromPvs(pvsRef.current, optsRef.current) ?? chosen;
        }
        const cb = cbRef.current;
        cbRef.current = null;
        modeRef.current = "single";
        pvsRef.current = [];
        optsRef.current = null;
        cb(chosen);
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

  /** Simple best-move with Stockfish skill level (legacy). */
  const requestMove = (fen: string, skill: number, movetimeMs: number, cb: BestMoveCb) => {
    const w = workerRef.current;
    if (!w) return;
    cbRef.current = cb;
    modeRef.current = "single";
    w.postMessage("setoption name MultiPV value 1");
    w.postMessage(`setoption name Skill Level value ${skill}`);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime ${movetimeMs}`);
  };

  /** Bot move with depth range, MultiPV, blunder injection, noise, and book. */
  const requestBotMove = (fen: string, opts: BotMoveOpts, cb: BestMoveCb) => {
    const w = workerRef.current;
    if (!w) return;

    // Tiny opening book — first move of the side only
    if (opts.openingRepertoire && (opts.ply ?? 0) === 0 && fen.split(" ")[1] === "w") {
      const head = opts.openingRepertoire[Math.floor(Math.random() * opts.openingRepertoire.length)];
      setTimeout(() => cb(head), 50);
      return;
    }

    cbRef.current = cb;
    modeRef.current = "multi";
    pvsRef.current = [];
    optsRef.current = opts;

    const depth = pickDepth(opts);
    w.postMessage("setoption name MultiPV value 3");
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth} movetime ${opts.movetimeMs}`);
  };

  return { requestMove, requestBotMove };
}
