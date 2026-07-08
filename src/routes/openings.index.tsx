import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { OPENINGS, opeCategoryLabel, type OpeningLine } from "@/lib/openings-data";
import { getMyOpeningProgress, type OpeningProgress } from "@/lib/openings.functions";
import { useAuth } from "@/lib/auth";
import { BookOpen, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/openings/")({
  head: () => ({
    meta: [
      { title: "Openings Trainer — Hamduk Chess" },
      { name: "description", content: "Learn opening theory line by line with quiz mode and personal repertoire tracking." },
      { property: "og:title", content: "Openings Trainer — Hamduk Chess" },
      { property: "og:description", content: "Master chess openings with interactive quiz training." },
    ],
  }),
  component: OpeningsIndex,
});

function OpeningsIndex() {
  const { user } = useAuth();
  const fetchProgress = useServerFn(getMyOpeningProgress);
  const { data: progress = [] } = useQuery({
    queryKey: ["my-opening-progress"],
    queryFn: () => fetchProgress() as Promise<OpeningProgress[]>,
    enabled: !!user,
  });

  const progressByEco = useMemo(() => {
    const m = new Map<string, OpeningProgress>();
    for (const p of progress) m.set(p.eco, p);
    return m;
  }, [progress]);

  const grouped = useMemo(() => {
    const g = new Map<OpeningLine["category"], OpeningLine[]>();
    for (const op of OPENINGS) {
      const list = g.get(op.category) ?? [];
      list.push(op);
      g.set(op.category, list);
    }
    return Array.from(g);
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          Learn
        </div>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">Openings Trainer</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Learn each opening line move by move in quiz mode. Progress is tracked per line;
          Gold members can save personal repertoires.
        </p>
      </header>

      <div className="space-y-8">
        {grouped.map(([cat, ops]) => (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {opeCategoryLabel(cat)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {ops.map((op) => {
                const prog = progressByEco.get(op.eco);
                const depth = prog?.mastered_depth ?? 0;
                const pct = Math.min(100, Math.round((depth / op.moves.length) * 100));
                const acc = prog && prog.attempts > 0
                  ? Math.round((prog.correct / prog.attempts) * 100)
                  : null;
                const mastered = depth >= op.moves.length;
                return (
                  <Link
                    key={op.eco}
                    to="/openings/$eco"
                    params={{ eco: op.eco }}
                    className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{op.eco}</span>
                          <span>·</span>
                          <span>{op.color === "white" ? "For White" : "For Black"}</span>
                        </div>
                        <h3 className="mt-1 truncate font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                          {op.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {op.description}
                        </p>
                      </div>
                      {mastered && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> Mastered
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-[10px] tabular-nums text-muted-foreground">
                        {depth}/{op.moves.length}
                      </span>
                    </div>
                    {acc !== null && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {prog!.attempts} attempts · {acc}% accuracy
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {!user && (
        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
          Sign in to track your progress across sessions.
        </div>
      )}
    </div>
  );
}
