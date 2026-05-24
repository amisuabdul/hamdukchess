import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PuzzleBoard } from "./PuzzleBoard";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  PUZZLES,
  PUZZLE_THEMES,
  getDailyPuzzle,
  type Puzzle,
  type PuzzleTheme,
} from "@/lib/puzzles-data";
import { loadProgress, recordAttempt, type PuzzleProgress } from "@/lib/puzzle-storage";

type Tab = "daily" | "rated" | "themes";

export function PuzzleHub() {
  const [tab, setTab] = useState<Tab>("daily");
  const [theme, setTheme] = useState<PuzzleTheme | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => getDailyPuzzle());
  const [progress, setProgress] = useState<PuzzleProgress>(() => loadProgress());

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // Pool of puzzles for current tab
  const pool = useMemo<Puzzle[]>(() => {
    if (tab === "themes" && theme) return PUZZLES.filter((p) => p.themes.includes(theme));
    if (tab === "rated") {
      // ±200 from user rating
      const r = progress.rating;
      return PUZZLES.filter((p) => Math.abs(p.rating - r) <= 250);
    }
    return [getDailyPuzzle()];
  }, [tab, theme, progress.rating]);

  const pickNext = useCallback(
    (currentId?: string) => {
      const available = pool.filter((p) => p.id !== currentId);
      const source = available.length ? available : pool;
      const next = source[Math.floor(Math.random() * source.length)];
      if (next) setPuzzle(next);
    },
    [pool],
  );

  // When switching tab/theme, load a fresh puzzle from the pool
  useEffect(() => {
    if (tab === "daily") {
      setPuzzle(getDailyPuzzle());
    } else if (pool.length > 0) {
      setPuzzle(pool[Math.floor(Math.random() * pool.length)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, theme]);

  const handleComplete = (success: boolean) => {
    const updated = recordAttempt(puzzle.id, success, puzzle.rating);
    setProgress(updated);
  };

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
          ) : (
            <>
              <PuzzleBoard puzzle={puzzle} onComplete={handleComplete} />
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => pickNext(puzzle.id)}
                  disabled={tab === "daily"}
                  className="px-5 py-2 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next puzzle →
                </button>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <StatCard label="Puzzle rating" value={progress.rating} hint={`${progress.totalSolved} solved`} />
          <StatCard
            label="Streak"
            value={`${progress.streakDays}d`}
            hint={progress.lastSolveDate ? `Last: ${progress.lastSolveDate}` : "Solve one today"}
            highlight
          />
          <StatCard label="Today" value={progress.attemptsToday} hint="attempts" />

          <div className="rounded-md bg-panel ring-1 ring-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Daily puzzle</p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Everyone gets the same puzzle each day. Solve it to keep your streak alive.
            </p>
            <button
              onClick={() => { setTab("daily"); }}
              className="mt-3 w-full px-3 py-2 text-xs font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer transition-colors"
            >
              Open today's puzzle
            </button>
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
