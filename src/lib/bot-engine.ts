// Bot move-selection engine: gaussian eval noise + blunder injection on top
// of Stockfish MultiPV output. Pure functions, no chess.js dependency.

export type Pv = { move: string; score: number };

export type BotMoveOpts = {
  depthMin: number;
  depthMax: number;
  /** 0..1 — chance to pick 2nd/3rd best instead of best */
  blunderRate: number;
  /** Centipawn-scale gaussian noise added to PV scores */
  randomness: number;
  movetimeMs: number;
  /** UCI moves to prefer on move 1 if legal */
  openingRepertoire?: string[];
  /** Current ply (used to gate opening book) */
  ply?: number;
};

function gaussian(): number {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pickDepth(opts: Pick<BotMoveOpts, "depthMin" | "depthMax">): number {
  return opts.depthMin + Math.floor(Math.random() * (opts.depthMax - opts.depthMin + 1));
}

/** Given Stockfish MultiPV results, pick a move with noise and blunder injection. */
export function pickFromPvs(pvs: Pv[], opts: Pick<BotMoveOpts, "blunderRate" | "randomness">): string | undefined {
  const filtered = pvs.filter(Boolean);
  if (filtered.length === 0) return undefined;

  const noised = filtered.map((p) => ({
    move: p.move,
    score: p.score + gaussian() * opts.randomness * 100,
  }));
  noised.sort((a, b) => b.score - a.score);

  if (Math.random() < opts.blunderRate && noised.length > 1) {
    if (noised.length >= 3 && Math.random() < 0.3) return noised[2].move;
    return noised[1].move;
  }
  return noised[0].move;
}
