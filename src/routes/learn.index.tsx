import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TUTORIALS } from "@/lib/tutorials-data";
import { getMyTutorialProgress } from "@/lib/tutorials.functions";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, GraduationCap, Clock } from "lucide-react";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: "Learn Chess — Interactive Beginner Tutorials | Hamduk Chess" },
      {
        name: "description",
        content:
          "Learn chess from zero with step-by-step interactive lessons. Board basics, piece moves, checkmate patterns, and opening principles.",
      },
      { property: "og:title", content: "Learn Chess — Interactive Tutorials" },
      {
        property: "og:description",
        content:
          "Step-by-step lessons: pieces, checkmate, openings. Practise on the board as you learn.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Learn page failed to load: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: LearnIndex,
});

function LearnIndex() {
  const { user } = useAuth();
  const fetchProgress = useServerFn(getMyTutorialProgress);

  const { data: progress = [] } = useQuery({
    queryKey: ["tutorial-progress", user?.id],
    queryFn: () => fetchProgress(),
    enabled: !!user,
  });

  const progressMap = new Map(progress.map((p) => [p.tutorial_id, p]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 md:pb-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <GraduationCap className="h-4 w-4" /> Learn
        </div>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">
          Beginner Tutorials
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Bite-sized interactive lessons. Read the tip, play the move, move on. No account
          required to try — sign in to save your progress.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {TUTORIALS.map((t) => {
          const p = progressMap.get(t.id);
          const done = p?.completed ?? false;
          const stepIdx = p?.step_index ?? 0;
          const pct = done
            ? 100
            : Math.round((stepIdx / t.steps.length) * 100);
          return (
            <li key={t.id}>
              <Link
                to="/learn/$tutorialId"
                params={{ tutorialId: t.id }}
                className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold text-foreground">
                        {t.title}
                      </h2>
                      {done && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Completed" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t.level}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{t.estimatedMinutes} min
                  </span>
                  <span>·</span>
                  <span>{t.steps.length} steps</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {!user && (
        <p className="mt-6 text-xs text-muted-foreground">
          <Link to="/login" className="underline">Sign in</Link> to save progress across devices.
        </p>
      )}
    </div>
  );
}
