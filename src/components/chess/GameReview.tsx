import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Loader2, X } from "lucide-react";
import {
  ReviewAnalyzer,
  type GameReviewResult,
  type MoveReview,
  CLASSIFICATION_META,
} from "@/lib/game-review";
import { classifyOpening } from "@/lib/eco";

type Props = {
  startFen: string;
  sanMoves: string[];
  orientation: "white" | "black";
  depth?: number;
  onClose: () => void;
};

export function GameReview({ startFen, sanMoves, orientation, depth = 14, onClose }: Props) {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GameReviewResult | null>(null);
  const [selectedPly, setSelectedPly] = useState(0);
  const analyzerRef = useRef<ReviewAnalyzer | null>(null);

  useEffect(() => {
    const a = new ReviewAnalyzer();
    analyzerRef.current = a;
    a.analyze(startFen, sanMoves, depth, (done, total) => {
      setProgress(Math.round((done / total) * 100));
    })
      .then((r) => setResult(r))
      .catch(() => {});
    return () => { a.dispose(); analyzerRef.current = null; };
  }, [startFen, sanMoves, depth]);

  const opening = useMemo(() => {
    const uciList: string[] = [];
    const c = new Chess(startFen);
    for (const san of sanMoves) {
      const mv = c.move(san);
      if (!mv) break;
      uciList.push(mv.from + mv.to + (mv.promotion ?? ""));
    }
    return classifyOpening(uciList);
  }, [startFen, sanMoves]);

  const boardFen = useMemo(() => {
    if (!result) return startFen;
    if (selectedPly === 0) return startFen;
    return result.moves[selectedPly - 1]?.fenAfter ?? startFen;
  }, [result, selectedPly, startFen]);

  const bestArrow = useMemo(() => {
    if (!result || selectedPly === 0) return undefined;
    const m = result.moves[selectedPly - 1];
    if (!m?.bestMove) return undefined;
    return [{
      startSquare: m.bestMove.slice(0, 2),
      endSquare: m.bestMove.slice(2, 4),
      color: "rgba(20, 130, 60, 0.75)",
    }] as unknown as Array<{ startSquare: string; endSquare: string; color: string }>;
  }, [result, selectedPly]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold">Game Review</h2>
            {opening && (
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{opening.eco}</span> · {opening.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!result && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing (depth {depth}) — {progress}%</p>
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <AccuracyCard label="White accuracy" value={result.accuracyWhite} />
                <AccuracyCard label="Black accuracy" value={result.accuracyBlack} />
              </div>

              <div className="aspect-square w-full max-w-[560px]">
                <Chessboard
                  options={{
                    position: boardFen,
                    boardOrientation: orientation,
                    allowDragging: false,
                    animationDurationInMs: 200,
                    id: "review-board",
                    arrows: bestArrow,
                  }}
                />
              </div>

              <EvalChart moves={result.moves} selected={selectedPly} onSelect={setSelectedPly} />
            </div>

            <MoveTable moves={result.moves} selected={selectedPly} onSelect={setSelectedPly} />
          </div>
        )}
      </div>
    </div>
  );
}

function AccuracyCard({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? "text-emerald-500" :
    value >= 75 ? "text-primary" :
    value >= 60 ? "text-yellow-500" : "text-orange-500";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-bold ${color}`}>{value.toFixed(1)}</p>
    </div>
  );
}

function EvalChart({ moves, selected, onSelect }: { moves: MoveReview[]; selected: number; onSelect: (i: number) => void }) {
  const w = 560, h = 100, pad = 8;
  const clamp = (cp: number) => Math.max(-800, Math.min(800, cp));
  const points = moves.map((m, i) => {
    const x = pad + (i / Math.max(1, moves.length - 1)) * (w - pad * 2);
    const y = h / 2 - (clamp(m.evalAfter) / 800) * (h / 2 - pad);
    return { x, y, cp: m.evalAfter, i };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${points.at(-1)?.x ?? pad} ${h / 2} L ${points[0]?.x ?? pad} ${h / 2} Z`;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Evaluation</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
        <rect x={0} y={0} width={w} height={h / 2} className="fill-muted/40" />
        <rect x={0} y={h / 2} width={w} height={h / 2} className="fill-foreground/10" />
        <line x1={0} x2={w} y1={h / 2} y2={h / 2} className="stroke-border" strokeWidth={0.5} />
        <path d={area} className="fill-primary/30" />
        <path d={path} className="stroke-primary" strokeWidth={1.5} fill="none" />
        {selected > 0 && points[selected - 1] && (
          <line x1={points[selected - 1].x} x2={points[selected - 1].x} y1={0} y2={h} className="stroke-accent" strokeWidth={1} />
        )}
        {points.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={2}
            className={selected === p.i + 1 ? "fill-accent" : "fill-primary"}
            onClick={() => onSelect(p.i + 1)} style={{ cursor: "pointer" }} />
        ))}
      </svg>
    </div>
  );
}

function MoveTable({ moves, selected, onSelect }: { moves: MoveReview[]; selected: number; onSelect: (i: number) => void }) {
  const rows: { num: number; w?: MoveReview; b?: MoveReview }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ num: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }

  const counts = moves.reduce<Record<string, { w: number; b: number }>>((acc, m) => {
    acc[m.classification] ??= { w: 0, b: 0 };
    acc[m.classification][m.color]++;
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 space-y-1">
        {(["blunder", "mistake", "inaccuracy", "good", "best", "book"] as const).map((k) => {
          const c = counts[k];
          if (!c) return null;
          const meta = CLASSIFICATION_META[k];
          return (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
              <span className="tabular-nums text-muted-foreground">
                <span className="mr-3">♔ {c.w}</span>
                <span>♚ {c.b}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="max-h-[520px] overflow-y-auto font-mono text-sm">
        {rows.map((r) => (
          <div key={r.num} className="flex items-center gap-1 py-0.5">
            <span className="w-8 text-right text-muted-foreground">{r.num}.</span>
            <MoveCell m={r.w} selected={selected === r.num * 2 - 1} onClick={() => r.w && onSelect(r.num * 2 - 1)} />
            <MoveCell m={r.b} selected={selected === r.num * 2} onClick={() => r.b && onSelect(r.num * 2)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCell({ m, selected, onClick }: { m?: MoveReview; selected: boolean; onClick: () => void }) {
  if (!m) return <span className="w-24" />;
  const meta = CLASSIFICATION_META[m.classification];
  return (
    <button
      onClick={onClick}
      className={`flex w-24 items-center justify-between rounded px-2 py-0.5 text-left hover:bg-muted ${selected ? "bg-primary/15 ring-1 ring-primary" : ""}`}
    >
      <span>{m.san}</span>
      <span className={`text-xs ${meta.color}`}>{meta.symbol}</span>
    </button>
  );
}
