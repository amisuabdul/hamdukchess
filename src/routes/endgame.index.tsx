import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ENDGAMES, ENDGAME_CATEGORIES, type EndgameCategory } from "@/lib/endgames-data";
import { getMyEndgameProgress, type EndgameProgress } from "@/lib/endgames.functions";
import { useAuth } from "@/lib/auth";
import { GraduationCap, Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/endgame/")({
  head: () => ({
    meta: [
      { title: "Endgame Training — Hamduk Chess" },
      {
        name: "description",
        content:
          "Master essential endgames — basic mates, pawn play, rook endings, and more — against a chess engine.",
      },
      { property: "og:title", content: "Endgame Training — Hamduk Chess" },
      {
        property: "og:description",
        content: "Play out classic endgame positions against Stockfish and track your progress.",
      },
    ],
  }),
  component: EndgameIndex,
});

function EndgameIndex() {
  const { user } = useAuth();
  const fetchProgress = useServerFn(getMyEndgameProgress);
  const { data: progress = [] } = useQuery({
    queryKey: ["my-endgame-progress"],
    queryFn: () => fetchProgress() as Promise<EndgameProgress[]>,
    enabled: !!user,
  });

  const progressById = useMemo(() => {
    const m = new Map<string, EndgameProgress>();
    for (const p of progress) m.set(p.endgame_id, p);
    return m;
  }, [progress]);

  const grouped = useMemo(() => {
    return ENDGAME_CATEGORIES.map((c) => ({
      category: c,
      items: ENDGAMES.filter((e) => e.category === c.id),
    })).filter((g) => g.items.length > 0);
  }, []);

  const solved = progress.filter((p) => p.completed).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5" />
          Learn
        </div>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">Endgame Training</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Play essential endgames against the engine. Each position has a concrete goal —
          mate in N, promote a pawn, or hold the draw — and progress is tracked per position.
        </p>
        {user && (
          <p className="mt-2 text-xs text-muted-foreground">
            {solved} of {ENDGAMES.length} solved
          </p>
        )}
      </header>

      <div className="space-y-8">
        {grouped.map(({ category, items }) => (
          <section key={category.id}>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category.label}
              </h2>
              <p className="text-xs text-muted-foreground/80">{category.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((eg) => {
                const p = progressById.get(eg.id);
                const done = Boolean(p?.completed);
                return (
                  <Link
                    key={eg.id}
                    to="/endgame/$id"
                    params={{ id: eg.id }}
                    className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>Difficulty {eg.difficulty}/5</span>
                          <span>·</span>
                          <span>{eg.userColor === "white" ? "White" : "Black"} to move</span>
                        </div>
                        <h3 className="mt-1 truncate font-serif text-lg font-semibold text-foreground group-hover:text-primary">
                          {eg.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {eg.description}
                        </p>
                      </div>
                      {done && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check className="h-3 w-3" /> Solved
                        </span>
                      )}
                    </div>
                    {p && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {p.attempts} attempt{p.attempts === 1 ? "" : "s"}
                        {p.best_move_count != null && ` · best ${p.best_move_count} moves`}
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
          Sign in to track which endgames you've solved.
        </div>
      )}
    </div>
  );
}
