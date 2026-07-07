import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTacticsThemes, getMyPuzzleStats, getMyThemeProgress } from "@/lib/puzzles.functions";
import { useAuth } from "@/lib/auth";
import { Flame, Target, Trophy, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/tactics/")({
  head: () => ({
    meta: [
      { title: "Tactics Trainer — Hamduk Chess" },
      {
        name: "description",
        content:
          "Themed tactical puzzle sets with spaced repetition. Master forks, pins, sacrifices, mates and more.",
      },
      { property: "og:title", content: "Tactics Trainer — Hamduk Chess" },
      {
        property: "og:description",
        content:
          "Themed tactical puzzle sets with spaced repetition and adaptive difficulty.",
      },
    ],
  }),
  component: TacticsIndex,
});

const THEME_LABELS: Record<string, { label: string; blurb: string; emoji: string }> = {
  mateIn1: { label: "Mate in 1", blurb: "See the final blow.", emoji: "♛" },
  mateIn2: { label: "Mate in 2", blurb: "One quiet setup, then mate.", emoji: "♞" },
  mateIn3: { label: "Mate in 3", blurb: "Force the king into the net.", emoji: "♜" },
  backRankMate: { label: "Back-rank mate", blurb: "Pawn shield, no escape.", emoji: "♖" },
  fork: { label: "Fork", blurb: "Attack two pieces at once.", emoji: "🍴" },
  pin: { label: "Pin", blurb: "Freeze a defender.", emoji: "📌" },
  skewer: { label: "Skewer", blurb: "Force the valuable to move.", emoji: "🍢" },
  discoveredAttack: { label: "Discovered attack", blurb: "Unmask a hidden threat.", emoji: "👁" },
  deflection: { label: "Deflection", blurb: "Drag the defender away.", emoji: "🎯" },
  sacrifice: { label: "Sacrifice", blurb: "Give material to gain more.", emoji: "🔥" },
  trapping: { label: "Trapping", blurb: "Corner an enemy piece.", emoji: "🕸" },
  interference: { label: "Interference", blurb: "Block the defender's line.", emoji: "🚧" },
  endgame: { label: "Endgame tactics", blurb: "Convert with precision.", emoji: "🏁" },
};

function TacticsIndex() {
  const { user } = useAuth();
  const fetchThemes = useServerFn(getTacticsThemes);
  const fetchStats = useServerFn(getMyPuzzleStats);

  const { data: themes, isLoading } = useQuery({
    queryKey: ["tactics-themes", user?.id ?? "guest"],
    queryFn: () => fetchThemes(),
    staleTime: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["my-puzzle-stats"],
    queryFn: () => fetchStats(),
    enabled: !!user,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tactics Trainer
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">
          Pick a motif. Sharpen the pattern.
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Each theme is a live pool of puzzles served at your rating. Missed puzzles come back
          via spaced repetition until you own them.
          {!user && " Sign in to save your progress and get spaced-repetition reviews."}
        </p>
      </header>

      {user && stats && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <MiniStat label="Rating" value={stats.rating} Icon={Target} />
          <MiniStat label="Solved" value={stats.solved_count} Icon={Trophy} />
          <MiniStat label="Streak" value={`${stats.current_streak}d`} Icon={Flame} highlight />
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading themes…
        </div>
      ) : !themes || themes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No puzzles available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {themes.map((t) => {
            const meta = THEME_LABELS[t.theme] ?? {
              label: t.theme,
              blurb: "",
              emoji: "♙",
            };
            const masteryPct =
              t.total > 0 ? Math.min(100, Math.round((t.solved / t.total) * 100)) : 0;
            return (
              <Link
                key={t.theme}
                to="/tactics/$theme"
                params={{ theme: t.theme }}
                className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-2xl">
                  {meta.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground">{meta.label}</h3>
                    {t.due > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                        {t.due} due
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {meta.blurb} · {t.total} puzzles · avg {t.avgRating}
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${masteryPct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{t.solved}/{t.total} solved</span>
                    <span>
                      {t.attempted > 0
                        ? `${Math.round(t.accuracy * 100)}% accuracy`
                        : "not started"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  Icon,
  highlight,
}: {
  label: string;
  value: string | number;
  Icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (highlight
          ? "border-amber-300/40 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-amber-500/10 dark:to-amber-500/5"
          : "border-border bg-card")
      }
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="mt-1 font-serif text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
