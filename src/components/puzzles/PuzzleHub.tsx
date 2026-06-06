import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PuzzleBoard } from "./PuzzleBoard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PUZZLES, PUZZLE_THEMES, type Puzzle, type PuzzleTheme } from "@/lib/puzzles-data";
import { loadProgress, recordAttempt, type PuzzleProgress } from "@/lib/puzzle-storage";
import {
  getNextPuzzle,
  getMyPuzzleStats,
  submitPuzzleAttempt,
  type ServerPuzzle,
} from "@/lib/puzzles.functions";
import { supabase } from "@/integrations/supabase/client";

type Tab = "daily" | "rated" | "themes";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PuzzleHub() {
  const [tab, setTab] = useState<Tab>("rated");
  const [theme, setTheme] = useState<PuzzleTheme | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [localProgress, setLocalProgress] = useState<PuzzleProgress>(() => loadProgress());
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  const fetchNext = useServerFn(getNextPuzzle);
  const fetchStats = useServerFn(getMyPuzzleStats);
  const submit = useServerFn(submitPuzzleAttempt);
  const navigate = useNavigate();

  // Detect auth
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSignedIn(event === "SIGNED_IN");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Server stats (signed-in only)
  const { data: serverStats, refetch: refetchStats } = useQuery({
    queryKey: ["my-puzzle-stats"],
    queryFn: () => fetchStats(),
    enabled: signedIn === true,
  });

  const loadNext = useCallback(async () => {
    if (signedIn) {
      const next = await fetchNext({
        data: tab === "themes" && theme ? { theme } : {},
      });
      if (next) setPuzzle(next as ServerPuzzle);
    } else {
      // Guest: pick from local pool
      const r = localProgress.rating;
      const pool =
        tab === "themes" && theme
          ? PUZZLES.filter((p) => p.themes.includes(theme))
          : PUZZLES.filter((p) => Math.abs(p.rating - r) <= 300);
      const list = pool.length ? pool : PUZZLES;
      setPuzzle(list[Math.floor(Math.random() * list.length)]);
    }
  }, [signedIn, fetchNext, tab, theme, localProgress.rating]);

  // Load when tab/theme/auth changes
  useEffect(() => {
    if (signedIn === null) return;
    if (tab === "daily") {
      navigate({ to: "/puzzles/daily/$date", params: { date: todayISO() } });
      return;
    }
    if (tab === "themes" && !theme) {
      setPuzzle(null);
      return;
    }
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, theme, signedIn]);

  const handleComplete = async (success: boolean) => {
    if (!puzzle) return;
    if (signedIn) {
      try {
        const res = await submit({ data: { puzzleId: puzzle.id, success } });
        setLastDelta(res.delta);
        refetchStats();
      } catch (e) {
        console.error(e);
      }
    } else {
      const updated = recordAttempt(puzzle.id, success, puzzle.rating);
      setLocalProgress(updated);
    }
  };

  const displayRating = serverStats?.rating ?? localProgress.rating;
  const displaySolved = serverStats?.solved_count ?? localProgress.totalSolved;
  const displayStreak = serverStats?.current_streak ?? localProgress.streakDays;
  const displayLast = serverStats?.last_solved_date ?? localProgress.lastSolveDate;

  return (
    <div className="min-h-screen bg-surface font-sans text-zinc-900">
      <nav className="h-12 border-b border-zinc-950/5 flex items-center justify-between px-6 bg-panel">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xs font-semibold tracking-wider uppercase text-zinc-400 hover:text-zinc-700 transition-colors">
            Hamduk Chess
          </Link>
          <div className="h-4 w-px bg-zinc-950/5" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-700">Puzzles</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/analysis" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Analysis</Link>
          <Link to="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Play</Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-[1280px] mx-auto px-6 md:px-12 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 md:gap-12 items-start">
        <section>
          <header className="mb-6">
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Sharpen your tactics
            </h1>
            <p className="text-sm text-zinc-500 mt-2 max-w-prose">
              Solve hand-picked tactical puzzles. Build a streak, climb the rating ladder, master themes.
              {signedIn === false && " Sign in to save your rating and progress."}
            </p>
          </header>

          <div className="flex gap-1 p-1 bg-zinc-200/60 rounded-md w-fit mb-6">
            {(["daily", "rated", "themes"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  "px-4 py-1.5 text-xs font-medium uppercase tracking-wider rounded cursor-pointer transition-colors " +
                  (tab === t ? "bg-panel shadow-sm ring-1 ring-black/5 text-zinc-900" : "text-zinc-500 hover:text-zinc-800")
                }
              >
                {t === "daily" ? "Daily" : t === "rated" ? "Rated ladder" : "Themes"}
              </button>
            ))}
          </div>

          {tab === "themes" && (
            <div className="flex flex-wrap gap-2 mb-6">
              {PUZZLE_THEMES.map((th) => (
                <button
                  key={th}
                  onClick={() => setTheme(th)}
                  className={
                    "px-3 py-1 text-xs font-medium rounded-full ring-1 cursor-pointer transition-colors " +
                    (theme === th
                      ? "bg-zinc-900 text-zinc-100 ring-zinc-900"
                      : "bg-panel text-zinc-700 ring-black/10 hover:bg-zinc-100")
                  }
                >
                  {th}
                </button>
              ))}
            </div>
          )}

          {tab === "themes" && !theme ? (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-12 text-center text-sm text-zinc-500">
              Pick a theme above to start solving.
            </div>
          ) : !puzzle ? (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-12 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : (
            <>
              <PuzzleBoard puzzle={puzzle} onComplete={handleComplete} />
              {lastDelta !== null && (
                <p className="text-center text-xs text-zinc-500 mt-3">
                  {lastDelta >= 0 ? "+" : ""}{lastDelta} rating
                </p>
              )}
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    setLastDelta(null);
                    void loadNext();
                  }}
                  className="px-5 py-2 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  Next puzzle →
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <StatCard label="Puzzle rating" value={displayRating} hint={`${displaySolved} solved`} />
          <StatCard
            label="Streak"
            value={`${displayStreak}d`}
            hint={displayLast ? `Last: ${displayLast}` : "Solve one today"}
            highlight
          />

          <div className="rounded-md bg-panel ring-1 ring-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Daily puzzle</p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Everyone gets the same puzzle each day. Solve it to keep your streak alive.
            </p>
            <Link
              to="/puzzles/daily/$date"
              params={{ date: todayISO() }}
              className="mt-3 block text-center w-full px-3 py-2 text-xs font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Open today's puzzle
            </Link>
          </div>

          <div className="rounded-md bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-300/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-2">Puzzle Storm · Plus</p>
            <p className="text-xs text-zinc-700 leading-relaxed">
              Three minutes. Solve as many tactics as you can. Climb the daily leaderboard.
            </p>
            <Link
              to="/puzzles/storm"
              className="mt-3 block text-center w-full px-3 py-2 text-xs font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Enter the storm →
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}

function StatCard({ label, value, hint, highlight }: { label: string; value: string | number; hint?: string; highlight?: boolean }) {
  return (
    <div
      className={
        "rounded-md p-4 ring-1 " +
        (highlight ? "bg-gradient-to-br from-amber-50 to-amber-100/40 ring-amber-300/40" : "bg-panel ring-black/5")
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p
        className="text-3xl font-bold mt-1"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}
