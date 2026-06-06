import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import {
  getStormStream,
  submitStormResult,
  getStormLeaderboard,
  getMyStormStats,
  type StormLeaderEntry,
} from "@/lib/storm.functions";
import type { Puzzle } from "@/lib/puzzles-data";

export const Route = createFileRoute("/puzzles/storm")({
  head: () => ({
    meta: [
      { title: "Puzzle Storm — Hamduk Chess" },
      { name: "description", content: "Three minutes. Solve as many tactics as you can. Plus & Gold only." },
      { property: "og:title", content: "Puzzle Storm — Hamduk Chess" },
      { property: "og:description", content: "Three-minute tactical rush against the clock." },
    ],
  }),
  component: StormPage,
});

type Phase = "idle" | "running" | "ended";
const DURATION = 180;

function StormPage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [tier, setTier] = useState<"free" | "plus" | "gold" | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [submitted, setSubmitted] = useState<null | {
    score: number;
    rank: { daily: number | null; allTime: number | null };
    personalBest: number;
  }>(null);
  const startedAtRef = useRef<number>(0);
  const submittedOnceRef = useRef(false);

  const fetchStream = useServerFn(getStormStream);
  const submit = useServerFn(submitStormResult);
  const fetchLb = useServerFn(getStormLeaderboard);
  const fetchMine = useServerFn(getMyStormStats);

  // Auth + tier
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const s = data.session;
      setSignedIn(!!s);
      if (!s) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", s.user.id)
        .maybeSingle();
      setTier(((prof?.subscription_tier ?? "free") as "free" | "plus" | "gold"));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const canPlay = signedIn === true && tier !== null && tier !== "free";

  const { data: leaderboard } = useQuery({
    queryKey: ["storm-lb", "daily"],
    queryFn: () => fetchLb({ data: { scope: "daily", limit: 10 } }) as Promise<StormLeaderEntry[]>,
    refetchInterval: 30_000,
  });

  const { data: mine } = useQuery({
    queryKey: ["storm-mine"],
    queryFn: () => fetchMine(),
    enabled: canPlay,
  });

  // Timer
  useEffect(() => {
    if (phase !== "running") return;
    const tick = setInterval(() => {
      const remaining = Math.max(0, DURATION - Math.floor((Date.now() - startedAtRef.current) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        setPhase("ended");
      }
    }, 250);
    return () => clearInterval(tick);
  }, [phase]);

  // Submit on end
  useEffect(() => {
    if (phase !== "ended" || submittedOnceRef.current) return;
    submittedOnceRef.current = true;
    submit({
      data: {
        score,
        solved: score,
        mistakes,
        durationSec: DURATION,
      },
    })
      .then((res) => setSubmitted(res))
      .catch((e) => console.error(e));
  }, [phase, score, mistakes, submit]);

  const start = useCallback(async () => {
    if (!canPlay) return;
    const { puzzles: list } = await fetchStream({ data: { count: 50 } });
    if (!list || list.length === 0) return;
    setPuzzles(list as Puzzle[]);
    setIdx(0);
    setScore(0);
    setMistakes(0);
    setTimeLeft(DURATION);
    setSubmitted(null);
    submittedOnceRef.current = false;
    startedAtRef.current = Date.now();
    setPhase("running");
  }, [canPlay, fetchStream]);

  const handleComplete = useCallback(
    (success: boolean) => {
      if (phase !== "running") return;
      if (success) setScore((s) => s + 1);
      else setMistakes((m) => m + 1);
      // Tiny pause for feedback then advance
      setTimeout(() => {
        setIdx((i) => Math.min(i + 1, puzzles.length - 1));
      }, 300);
    },
    [phase, puzzles.length],
  );

  // End if we run out of puzzles
  useEffect(() => {
    if (phase === "running" && idx >= puzzles.length - 1 && puzzles.length > 0) {
      // Last puzzle reached — let user finish it; nothing to do here
    }
  }, [phase, idx, puzzles.length]);

  const current = puzzles[idx];
  const mmss = useMemo(() => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  return (
    <div className="min-h-screen bg-surface font-sans text-zinc-900">
      <nav className="h-12 border-b border-zinc-950/5 flex items-center justify-between px-6 bg-panel">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xs font-semibold tracking-wider uppercase text-zinc-400 hover:text-zinc-700">
            Hamduk Chess
          </Link>
          <div className="h-4 w-px bg-zinc-950/5" />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-700">Puzzle Storm</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/puzzles" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
            ← All puzzles
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-[1280px] mx-auto px-6 md:px-12 py-8 md:py-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 md:gap-12 items-start">
        <section>
          <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-4xl md:text-5xl font-serif font-bold tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Puzzle Storm
              </h1>
              <p className="text-sm text-zinc-500 mt-2 max-w-prose">
                Three minutes. Solve as many tactics as you can. +1 per solve, no penalty for misses — just keep moving.
              </p>
            </div>
            {phase === "running" && (
              <div className="flex items-center gap-4">
                <Stat label="Time" value={mmss} highlight={timeLeft <= 30} />
                <Stat label="Score" value={score} />
                <Stat label="Misses" value={mistakes} />
              </div>
            )}
          </header>

          {signedIn === false && (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-8 text-center">
              <p className="text-sm text-zinc-600">Sign in to play Puzzle Storm.</p>
              <button
                onClick={() => navigate({ to: "/login" })}
                className="mt-4 px-5 py-2 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer"
              >
                Sign in
              </button>
            </div>
          )}

          {signedIn === true && tier === "free" && (
            <div className="rounded-md bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-300/40 p-8 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Plus & Gold</p>
              <h2 className="text-2xl font-serif font-bold mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Unlock Puzzle Storm
              </h2>
              <p className="text-sm text-zinc-600 mt-2 max-w-sm mx-auto">
                Three-minute tactical rush, daily and all-time leaderboards. Available on Plus and Gold.
              </p>
              <Link
                to="/billing"
                className="inline-block mt-4 px-5 py-2 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer"
              >
                See plans
              </Link>
            </div>
          )}

          {canPlay && phase === "idle" && (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-8 text-center">
              <p className="text-sm text-zinc-600 mb-4">Ready when you are.</p>
              <button
                onClick={start}
                className="px-6 py-3 text-sm font-semibold bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer"
              >
                Start 3-minute storm
              </button>
              {mine && mine.best > 0 && (
                <p className="text-xs text-zinc-500 mt-4">
                  Your best: <span className="font-semibold text-zinc-800">{mine.best}</span> · {mine.runs} runs
                </p>
              )}
            </div>
          )}

          {canPlay && phase === "running" && current && (
            <PuzzleBoard key={current.id + ":" + idx} puzzle={current as Puzzle} onComplete={handleComplete} />
          )}

          {canPlay && phase === "ended" && (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-8 text-center space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Time's up</p>
              <p className="text-6xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {score}
              </p>
              <p className="text-xs text-zinc-500">
                {mistakes} miss{mistakes === 1 ? "" : "es"}
              </p>
              {submitted && (
                <div className="text-xs text-zinc-600 space-y-1 pt-2">
                  {submitted.rank.daily && (
                    <p>
                      Daily rank: <span className="font-semibold">#{submitted.rank.daily}</span>
                    </p>
                  )}
                  {submitted.rank.allTime && (
                    <p>
                      All-time rank: <span className="font-semibold">#{submitted.rank.allTime}</span>
                    </p>
                  )}
                  <p>
                    Personal best: <span className="font-semibold">{submitted.personalBest}</span>
                  </p>
                </div>
              )}
              <button
                onClick={start}
                className="mt-2 px-5 py-2 text-sm font-medium bg-zinc-900 text-zinc-100 rounded ring-1 ring-zinc-900 hover:bg-zinc-800 cursor-pointer"
              >
                Run it back
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-md bg-panel ring-1 ring-black/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Daily leaderboard
            </p>
            {(!leaderboard || leaderboard.length === 0) && (
              <p className="text-xs text-zinc-500">No runs yet today. Be first.</p>
            )}
            <ol className="space-y-1.5">
              {(leaderboard ?? []).map((row, i) => (
                <li key={row.user_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="text-zinc-400 w-5 text-right">{i + 1}</span>
                    <Link
                      to="/profile/$username"
                      params={{ username: row.username }}
                      className="text-zinc-800 hover:underline"
                    >
                      {row.username}
                    </Link>
                  </span>
                  <span className="font-semibold text-zinc-900 tabular-nums">{row.score}</span>
                </li>
              ))}
            </ol>
          </div>

          {canPlay && mine && mine.recent.length > 0 && (
            <div className="rounded-md bg-panel ring-1 ring-black/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Your recent runs
              </p>
              <ul className="space-y-1.5">
                {mine.recent.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      {new Date(r.played_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold text-zinc-900 tabular-nums">{r.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className={
        "px-3 py-1.5 rounded ring-1 text-center min-w-[64px] " +
        (highlight ? "bg-red-50 ring-red-300/60 text-red-700" : "bg-panel ring-black/5 text-zinc-800")
      }
    >
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
