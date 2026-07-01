import { Chess } from "chess.js";

export type Classification =
  | "brilliant"
  | "great"
  | "best"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "book";

export type MoveReview = {
  ply: number;              // 1-indexed
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  evalBefore: number;       // cp from White's POV
  evalAfter: number;        // cp from White's POV
  bestMove: string | null;  // uci
  bestEval: number | null;  // cp from White's POV of best line
  cpLoss: number;           // >=0, from the mover's POV
  classification: Classification;
};

export type GameReviewResult = {
  depth: number;
  moves: MoveReview[];
  accuracyWhite: number;    // 0-100
  accuracyBlack: number;    // 0-100
};

/** Uses a dedicated Stockfish worker to analyze every ply.
 *  Depth 14 (Plus) / 18-20 (Gold). Cancellable. */
export class ReviewAnalyzer {
  private worker: Worker;
  private url: string;
  private cancelled = false;
  private pending: ((line: string) => void) | null = null;

  constructor() {
    const code = `importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');`;
    const blob = new Blob([code], { type: "application/javascript" });
    this.url = URL.createObjectURL(blob);
    this.worker = new Worker(this.url);
    this.worker.postMessage("uci");
    this.worker.postMessage("isready");
    this.worker.postMessage("setoption name MultiPV value 1");
  }

  cancel() {
    this.cancelled = true;
    try { this.worker.postMessage("stop"); } catch {}
  }

  dispose() {
    this.cancel();
    try { this.worker.terminate(); } catch {}
    URL.revokeObjectURL(this.url);
  }

  /** Returns cp (positive = White better) and best move for `fen` at `depth`. */
  private evaluate(fen: string, depth: number): Promise<{ cp: number; best: string | null }> {
    return new Promise((resolve) => {
      let cp = 0;
      let mateSign = 0;
      let best: string | null = null;
      const stm = fen.split(" ")[1] === "w" ? 1 : -1;

      const onLine = (line: string) => {
        const score = line.match(/score\s+(cp|mate)\s+(-?\d+)/);
        if (score) {
          const raw = parseInt(score[2], 10);
          if (score[1] === "mate") {
            mateSign = Math.sign(raw);
            cp = mateSign * (100000 - Math.abs(raw));
          } else {
            cp = raw;
            mateSign = 0;
          }
        }
        const bm = line.match(/^bestmove\s+(\S+)/);
        if (bm) {
          best = bm[1] === "(none)" ? null : bm[1];
          this.pending = null;
          // Convert cp from side-to-move POV to White POV
          resolve({ cp: cp * stm, best });
        }
      };
      this.pending = onLine;
      this.worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (this.pending) this.pending(line);
      };
      this.worker.postMessage("ucinewgame");
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  /** Analyze the game's SAN move list starting from `startFen`. */
  async analyze(
    startFen: string,
    sanMoves: string[],
    depth: number,
    onProgress?: (done: number, total: number) => void,
  ): Promise<GameReviewResult> {
    const chess = new Chess(startFen);
    const positions: { fenBefore: string; fenAfter: string; san: string; uci: string; color: "w" | "b" }[] = [];
    for (const san of sanMoves) {
      const fenBefore = chess.fen();
      const mv = chess.move(san);
      if (!mv) break;
      positions.push({
        fenBefore,
        fenAfter: chess.fen(),
        san: mv.san,
        uci: mv.from + mv.to + (mv.promotion ?? ""),
        color: mv.color,
      });
    }

    // Evaluate the start once, then each fenAfter.
    const evals: { cp: number; best: string | null }[] = [];
    const start = await this.evaluate(startFen, depth);
    evals.push(start);
    for (let i = 0; i < positions.length; i++) {
      if (this.cancelled) break;
      const e = await this.evaluate(positions[i].fenAfter, depth);
      evals.push(e);
      onProgress?.(i + 1, positions.length);
    }

    const moves: MoveReview[] = [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const evalBefore = evals[i].cp;
      const evalAfter = evals[i + 1]?.cp ?? evalBefore;
      // cpLoss from mover's POV
      const sign = p.color === "w" ? 1 : -1;
      const cpLoss = Math.max(0, (evalBefore - evalAfter) * sign);
      const wasBook = i < 12 && cpLoss < 25; // rough "book" heuristic for first 6 moves each side
      moves.push({
        ply: i + 1,
        san: p.san,
        uci: p.uci,
        color: p.color,
        fenBefore: p.fenBefore,
        fenAfter: p.fenAfter,
        evalBefore,
        evalAfter,
        bestMove: evals[i].best,
        bestEval: evals[i].cp,
        cpLoss,
        classification: wasBook ? "book" : classify(cpLoss, p.uci === evals[i].best),
      });
    }

    return {
      depth,
      moves,
      accuracyWhite: computeAccuracy(moves.filter(m => m.color === "w")),
      accuracyBlack: computeAccuracy(moves.filter(m => m.color === "b")),
    };
  }
}

function classify(cpLoss: number, isTop: boolean): Classification {
  if (isTop) return "best";
  if (cpLoss < 15) return "best";
  if (cpLoss < 40) return "good";
  if (cpLoss < 90) return "inaccuracy";
  if (cpLoss < 200) return "mistake";
  return "blunder";
}

/** Lichess-style accuracy: winPct(before) - winPct(after) mapped 0-100. */
function computeAccuracy(moves: MoveReview[]): number {
  if (moves.length === 0) return 100;
  let sum = 0;
  for (const m of moves) {
    const sign = m.color === "w" ? 1 : -1;
    const before = winPct(m.evalBefore * sign);
    const after = winPct(m.evalAfter * sign);
    const drop = Math.max(0, before - after);
    // Lichess formula: 103.1668 * exp(-0.04354 * drop) - 3.1669
    const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
    sum += Math.max(0, Math.min(100, acc));
  }
  return Math.round((sum / moves.length) * 10) / 10;
}

/** Sigmoid mapping cp → win % from mover's POV. */
function winPct(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export const CLASSIFICATION_META: Record<Classification, { label: string; color: string; symbol: string }> = {
  brilliant:  { label: "Brilliant",  color: "text-cyan-400",   symbol: "!!" },
  great:      { label: "Great",      color: "text-blue-400",   symbol: "!" },
  best:       { label: "Best",       color: "text-emerald-500", symbol: "★" },
  good:       { label: "Good",       color: "text-emerald-400", symbol: "" },
  book:       { label: "Book",       color: "text-amber-500",   symbol: "📖" },
  inaccuracy: { label: "Inaccuracy", color: "text-yellow-500", symbol: "?!" },
  mistake:    { label: "Mistake",    color: "text-orange-500", symbol: "?" },
  blunder:    { label: "Blunder",    color: "text-red-500",    symbol: "??" },
};
