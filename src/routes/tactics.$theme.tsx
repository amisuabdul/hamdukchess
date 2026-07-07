import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";
import {
  getNextPuzzle,
  submitPuzzleAttempt,
  getMyPuzzleStats,
  type ServerPuzzle,
} from "@/lib/puzzles.functions";
import { PUZZLES } from "@/lib/puzzles-data";
import { loadProgress, recordAttempt } from "@/lib/puzzle-storage";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, Flame, Target, Check, X } from "lucide-react";

export const Route = createFileRoute("/tactics/$theme")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.theme} — Tactics Trainer` },
      { name: "description", content: `Practice ${params.theme} tactical puzzles.` },
    ],
  }),
  component: TacticsSession,
});

const SESSION_SIZE = 10;

function TacticsSession() {
  const { theme } = Route.useParams();
  const { user } = useAuth();
  const fetchNext = useServerFn(getNextPuzzle);
  const submit = useServerFn(submitPuzzleAttempt);
  const fetchStats = useServerFn(getMyPuzzleStats);

  const [puzzle, setPuzzle] = useState<ServerPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [session, setSession] = useState({
    index: 0,
    solved: 0,
    failed: 0,
    streak: 0,
    bestStreak: 0,
    done: false,
    history: [] as { id: string; success: boolean }[],
  });
  const [resolved, setResolved] = useState<string | null>(null);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["my-puzzle-stats"],
    queryFn: () => fetchStats(),
    enabled: !!user,
  });

  const loadNext = useCallback(async () => {
    setLoading(true);
    setResolved(null);
    setLastDelta(null);
    try {
      if (user) {
        const next = await fetchNext({ data: { theme } });
        setPuzzle((next as ServerPuzzle) ?? null);
      } else {
        // Guest fallback — use bundled sample pool if the theme happens to be there,
        // else any puzzle from the sample pool.
        const localRating = loadProgress().rating;
        const pool = PUZZLES.filter((p) => p.themes.includes(theme));
        const src = pool.length ? pool : PUZZLES;
        const near = src.filter((p) => Math.abs(p.rating - localRating) <= 400);
        const list = near.length ? near : src;
        const pick = list[Math.floor(Math.random() * list.length)];
        setPuzzle({
          id: pick.id,
          fen: pick.fen,
          solution: pick.solution,
          themes: pick.themes,
          rating: pick.rating,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, fetchNext, theme]);

  useEffect(() => {
    setSession({
      index: 0,
      solved: 0,
      failed: 0,
      streak: 0,
      bestStreak: 0,
      done: false,
      history: [],
    });
    void loadNext();
  }, [theme, loadNext]);

  const handleComplete = async (success: boolean) => {
    if (!puzzle || resolved === puzzle.id) return;
    setResolved(puzzle.id);

    // Persist
    if (user) {
      try {
        const res = await submit({ data: { puzzleId: puzzle.id, success } });
        setLastDelta(res.delta);
        refetchStats();
      } catch (e) {
        console.error(e);
      }
    } else {
      recordAttempt(puzzle.id, success, puzzle.rating);
    }

    // Update session
    setSession((s) => {
      const nextStreak = success ? s.streak + 1 : 0;
      const nextIndex = s.index + 1;
      return {
        ...s,
        index: nextIndex,
        solved: s.solved + (success ? 1 : 0),
        failed: s.failed + (success ? 0 : 1),
        streak: nextStreak,
        bestStreak: Math.max(s.bestStreak, nextStreak),
        done: nextIndex >= SESSION_SIZE,
        history: [...s.history, { id: puzzle.id, success }],
      };
    });
  };

  const goNext = () => {
    if (session.done) return;
    void loadNext();
  };

  const restart = () => {
    setSession({
      index: 0,
      solved: 0,
      failed: 0,
      streak: 0,
      bestStreak: 0,
      done: false,
      history: [],
    });
    void loadNext();
  };

  const progressPct = Math.round((session.index / SESSION_SIZE) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/tactics"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All themes
        </Link>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {user && stats && (
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3" /> {stats.rating}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Flame className="h-3 w-3" /> {session.streak}
          </span>
        </div>
      </div>

      <header className="mb-4">
        <h1 className="font-serif text-2xl font-bold capitalize text-foreground">
          {theme.replace(/([A-Z])/g, " $1")}
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {session.index}/{SESSION_SIZE}
          </span>
        </div>
        {session.history.length > 0 && (
          <div className="mt-2 flex gap-1">
            {Array.from({ length: SESSION_SIZE }).map((_, i) => {
              const h = session.history[i];
              return (
                <div
                  key={i}
                  className={
                    "h-1.5 flex-1 rounded-full " +
                    (h
                      ? h.success
                        ? "bg-emerald-500"
                        : "bg-red-500"
                      : "bg-muted/40")
                  }
                />
              );
            })}
          </div>
        )}
      </header>

      {session.done ? (
        <SessionSummary
          solved={session.solved}
          failed={session.failed}
          bestStreak={session.bestStreak}
          onRestart={restart}
        />
      ) : loading || !puzzle ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading puzzle…
        </div>
      ) : (
        <div>
          <PuzzleBoard key={puzzle.id} puzzle={puzzle} onComplete={handleComplete} />
          {resolved && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {lastDelta !== null && (
                <p className="text-xs text-muted-foreground">
                  {lastDelta >= 0 ? "+" : ""}
                  {lastDelta} rating
                </p>
              )}
              <button
                onClick={goNext}
                className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {session.index >= SESSION_SIZE - 1 ? "Finish session" : "Next puzzle →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionSummary({
  solved,
  failed,
  bestStreak,
  onRestart,
}: {
  solved: number;
  failed: number;
  bestStreak: number;
  onRestart: () => void;
}) {
  const accuracy = solved + failed > 0 ? Math.round((solved / (solved + failed)) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="font-serif text-3xl font-bold text-foreground">Session complete</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {accuracy}% accuracy · best streak {bestStreak}
      </p>
      <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-300/40 bg-emerald-50 p-4 dark:bg-emerald-500/10">
          <Check className="mx-auto h-5 w-5 text-emerald-600" />
          <p className="mt-1 font-serif text-2xl font-bold text-emerald-900 dark:text-emerald-200">
            {solved}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Solved
          </p>
        </div>
        <div className="rounded-lg border border-red-300/40 bg-red-50 p-4 dark:bg-red-500/10">
          <X className="mx-auto h-5 w-5 text-red-600" />
          <p className="mt-1 font-serif text-2xl font-bold text-red-900 dark:text-red-200">
            {failed}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-300">
            Missed
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onRestart}
          className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          New session
        </button>
        <Link
          to="/tactics"
          className="rounded border border-border bg-card px-5 py-2 text-sm font-semibold text-foreground hover:bg-accent"
        >
          Change theme
        </Link>
      </div>
    </div>
  );
}
