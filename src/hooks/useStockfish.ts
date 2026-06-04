import { useEffect, useRef } from "react";

type BestMoveCb = (uci: string) => void;

type BotMoveOpts = {
  depthMin: number;
  depthMax: number;
  /** 0..1 — chance to play 2nd/3rd-best instead of best */
  blunderRate: number;
  /** Centipawn-scale gaussian noise added to PV scores */
  randomness: number;
  movetimeMs: number;
  /** UCI moves to prefer on move 1 if legal (rough opening book) */
  openingRepertoire?: string[];
  /** Current ply (used to gate opening book) */
  ply?: number;
};

type Pv = { move: string; score: number };

function gaussian(): number {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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
        // Parse MultiPV info lines: "info ... multipv N ... score cp X ... pv MOVE ..."
        const mpv = line.match(/multipv\s+(\d+)/);
        const score = line.match(/score\s+(cp|mate)\s+(-?\d+)/);
        const pv = line.match(/\spv\s+(\S+)/);
        if (mpv && score && pv) {
          const idx = parseInt(mpv[1], 10) - 1;
          const raw = parseInt(score[2], 10);
          // Treat mate as a very large cp score, sign-preserved
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

  /** Legacy / simple: ask Stockfish for best move at a given skill level. */
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

  /** Bot move with depth range, blunder injection, eval noise, and tiny opening book. */
  const requestBotMove = (fen: string, opts: BotMoveOpts, cb: BestMoveCb) => {
    const w = workerRef.current;
    if (!w) return;

    // Opening book: very early plies pick from repertoire if legal-shaped (rough — engine validates anyway via go).
    if (opts.openingRepertoire && (opts.ply ?? 0) <= 1 && opts.openingRepertoire.length > 0) {
      const head = opts.openingRepertoire[Math.floor(Math.random() * opts.openingRepertoire.length)];
      // Heuristic: only trust opening book on the very first move of the side
      if ((opts.ply ?? 0) === 0 && fen.split(" ")[1] === "w") {
        // Issue normal MultiPV but bias toward head — simplest: just play book move directly.
        setTimeout(() => cb(head), 50);
        return;
      }
    }

    cbRef.current = cb;
    modeRef.current = "multi";
    pvsRef.current = [];
    optsRef.current = opts;

    const depth = opts.depthMin + Math.floor(Math.random() * (opts.depthMax - opts.depthMin + 1));
    w.postMessage("setoption name MultiPV value 3");
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth} movetime ${opts.movetimeMs}`);
  };

  return { requestMove, requestBotMove };
}

function pickFromPvs(pvs: Pv[], opts: BotMoveOpts): string | undefined {
  const filtered = pvs.filter(Boolean);
  if (filtered.length === 0) return undefined;

  // Add gaussian eval noise
  const noised = filtered.map((p) => ({
    move: p.move,
    score: p.score + gaussian() * opts.randomness * 100,
  }));
  noised.sort((a, b) => b.score - a.score);

  // Blunder injection: with probability blunderRate, pick 2nd or 3rd (70/30)
  if (Math.random() < opts.blunderRate && noised.length > 1) {
    if (noised.length >= 3 && Math.random() < 0.3) return noised[2].move;
    return noised[1].move;
  }
  return noised[0].move;
}
