import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Sparkles, TrendingDown } from "lucide-react";
import { getMyWeaknessReport, recomputeMyWeaknessReport } from "@/lib/weakness.functions";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "My Weaknesses — Hamduk Chess Insights" },
      {
        name: "description",
        content:
          "See which pieces, phases and openings cost you points, plus a heatmap of squares where you lose material most.",
      },
      { property: "og:title", content: "My Weaknesses — Hamduk Chess Insights" },
      {
        property: "og:description",
        content:
          "Personalized chess weakness detection: piece blunders, phase errors, opening gaps and a capture heatmap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsightsPage,
});

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
const PHASES = ["opening", "middlegame", "endgame"] as const;

type Suggestion = { title: string; detail: string; href: string };

function InsightsPage() {
  const fetchReport = useServerFn(getMyWeaknessReport);
  const recompute = useServerFn(recomputeMyWeaknessReport);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["weakness-report"],
    queryFn: () => fetchReport(),
  });

  const refresh = useMutation({
    mutationFn: () => recompute(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["weakness-report"] });
      toast.success("Report updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const report = data?.report;
  const heatmap = (report?.capture_heatmap ?? {}) as Record<string, number>;
  const maxHeat = Math.max(1, ...Object.values(heatmap));
  const pieceBlunders = (report?.piece_blunders ?? {}) as Record<string, number>;
  const maxPiece = Math.max(1, ...Object.values(pieceBlunders));
  const phaseErrors = (report?.phase_errors ?? {}) as Record<
    string,
    { errors: number; moves: number }
  >;
  const openingGaps = (report?.opening_gaps ?? []) as Array<{
    eco: string;
    name: string;
    games: number;
    win_rate: number;
  }>;
  const suggestions = (report?.suggestions ?? []) as Suggestion[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">My weaknesses</h1>
          <p className="text-sm text-muted-foreground">
            {report
              ? `Based on your last ${report.games_analyzed} finished games · updated ${new Date(
                  report.computed_at,
                ).toLocaleString()}`
              : "Gold members get a personalized breakdown of what is costing them points."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/assistant"
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground hover:bg-secondary/80"
          >
            <Sparkles className="h-4 w-4" /> Ask the coach
          </Link>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending ? "Analysing…" : "Recompute"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading your report…</p>}
      {error && <p className="text-sm text-muted-foreground">{(error as Error).message}</p>}

      {!isLoading && !report && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No report yet. Hit <span className="font-medium text-foreground">Recompute</span> to
          analyse your recent games. Weakness detection is a{" "}
          <Link to="/billing" className="text-primary underline">
            Gold
          </Link>{" "}
          feature.
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {report.summary && (
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h2 className="mb-1 flex items-center gap-1.5 font-serif text-base font-bold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Coach's take
              </h2>
              <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 font-serif text-base font-bold text-foreground">
                Costly moves by piece
              </h2>
              <ul className="space-y-2">
                {PIECES.map((p) => {
                  const n = pieceBlunders[p] ?? 0;
                  return (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="w-16 capitalize text-muted-foreground">{p}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(n / maxPiece) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right tabular-nums text-foreground">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 font-serif text-base font-bold text-foreground">
                Where errors concentrate
              </h2>
              <ul className="space-y-3">
                {PHASES.map((phase) => {
                  const s = phaseErrors[phase] ?? { errors: 0, moves: 0 };
                  const rate = s.moves > 0 ? Math.round((s.errors / s.moves) * 100) : 0;
                  return (
                    <li key={phase} className="text-sm">
                      <div className="flex justify-between">
                        <span className="capitalize text-muted-foreground">{phase}</span>
                        <span className="tabular-nums text-foreground">
                          {rate}% ({s.errors}/{s.moves})
                        </span>
                      </div>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-destructive"
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-1 font-serif text-base font-bold text-foreground">Capture heatmap</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Squares where your pieces were captured most in your last 50 games.
            </p>
            <div className="mx-auto grid w-full max-w-sm grid-cols-8 overflow-hidden rounded-md ring-1 ring-border">
              {RANKS.map((rank) =>
                FILES.map((file) => {
                  const sq = `${file}${rank}`;
                  const n = heatmap[sq] ?? 0;
                  const intensity = n / maxHeat;
                  return (
                    <div
                      key={sq}
                      title={`${sq}: ${n} captures`}
                      className="relative aspect-square"
                      style={{
                        backgroundColor:
                          n > 0
                            ? `color-mix(in srgb, var(--destructive) ${Math.round(
                                20 + intensity * 80,
                              )}%, transparent)`
                            : undefined,
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] tabular-nums text-foreground/70">
                        {n > 0 ? n : ""}
                      </span>
                    </div>
                  );
                }),
              )}
            </div>
          </section>

          {openingGaps.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-1.5 font-serif text-base font-bold text-foreground">
                <TrendingDown className="h-4 w-4 text-destructive" /> Opening gaps
              </h2>
              <ul className="divide-y divide-border">
                {openingGaps.map((o) => (
                  <li key={o.eco} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-foreground">
                      {o.name || o.eco}{" "}
                      <span className="text-xs text-muted-foreground">({o.games} games)</span>
                    </span>
                    <span className="tabular-nums text-destructive">{o.win_rate}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-serif text-lg font-bold text-foreground">What to do next</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {suggestions.map((s) => (
                <Link
                  key={s.title}
                  to={s.href}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <p className="font-medium text-foreground">{s.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
