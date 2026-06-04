import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Swords, Trophy, X, Bot } from "lucide-react";
import { GuestUpgradeBanner } from "@/components/GuestUpgradeBanner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { findOrJoinMatch, cancelQueue } from "@/lib/matchmaking.functions";
import { nearestBot } from "@/lib/bot-personas";

export const Route = createFileRoute("/lobby")({
  head: () => ({
    meta: [
      { title: "Lobby — Hamduk Chess" },
      { name: "description", content: "Find a rated online chess opponent in seconds." },
    ],
  }),
  component: LobbyPage,
});

const TIME_CONTROLS = [
  { id: "3+0", label: "Blitz", sub: "3 min" },
  { id: "5+0", label: "Blitz", sub: "5 min" },
  { id: "10+0", label: "Rapid", sub: "10 min" },
  { id: "15+10", label: "Rapid", sub: "15 | +10" },
] as const;

const REGIONS = [
  { id: "africa-west-1", label: "Africa West" },
  { id: "global",        label: "Global" },
] as const;

// Expanding rating window: ±50 → ±100 → ±150 → ±300 every 10s
const WINDOW_STEPS = [50, 100, 150, 300];
function windowAt(elapsedMs: number) {
  const step = Math.min(WINDOW_STEPS.length - 1, Math.floor(elapsedMs / 10_000));
  return WINDOW_STEPS[step];
}

function LobbyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const find = useServerFn(findOrJoinMatch);
  const cancel = useServerFn(cancelQueue);
  const [searching, setSearching] = useState<string | null>(null);
  const [variant, setVariant] = useState<"standard" | "chess960">("standard");
  const [region, setRegion] = useState<(typeof REGIONS)[number]["id"]>("africa-west-1");
  const [elapsed, setElapsed] = useState(0);
  const [showBotOffer, setShowBotOffer] = useState(false);
  const searchStartRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Realtime: jump into game as soon as our row appears
  useEffect(() => {
    if (!user || !searching) return;
    const channel = supabase
      .channel(`lobby:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "games", filter: `white_id=eq.${user.id}` }, (payload) => {
        navigate({ to: "/play/$gameId", params: { gameId: (payload.new as { id: string }).id } });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "games", filter: `black_id=eq.${user.id}` }, (payload) => {
        navigate({ to: "/play/$gameId", params: { gameId: (payload.new as { id: string }).id } });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, searching, navigate]);

  // Polling loop with expanding window, bot suggestion at 60s, auto-cancel at 120s
  useEffect(() => {
    if (!searching) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      searchStartRef.current = null;
      setElapsed(0);
      setShowBotOffer(false);
      return;
    }
    searchStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      const el = Date.now() - (searchStartRef.current ?? Date.now());
      setElapsed(el);

      if (el >= 60_000 && !showBotOffer) setShowBotOffer(true);

      if (el >= 120_000) {
        try { await cancel({}); } catch { /* ignore */ }
        setSearching(null);
        toast.info("No opponent found. We've removed you from the queue — try again in a moment.");
        return;
      }

      try {
        const { gameId } = await find({
          data: {
            timeControl: searching as "3+0" | "5+0" | "10+0" | "15+10",
            variant,
          },
        });
        if (gameId) {
          navigate({ to: "/play/$gameId", params: { gameId } });
        }
      } catch { /* retry next tick */ }
    }, 2_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [searching, variant, find, cancel, navigate, showBotOffer]);

  async function handleFind(tc: string) {
    setSearching(tc);
    try {
      const { gameId } = await find({ data: { timeControl: tc as "3+0" | "5+0" | "10+0" | "15+10", variant } });
      if (gameId) {
        navigate({ to: "/play/$gameId", params: { gameId } });
      } else {
        toast.info(`Searching ${REGIONS.find((r) => r.id === region)?.label} for ${tc} ${variant}…`);
      }
    } catch (e) {
      setSearching(null);
      toast.error(e instanceof Error ? e.message : "Could not join queue");
    }
  }

  async function handleCancel() {
    try { await cancel({}); } catch { /* ignore */ }
    setSearching(null);
  }

  function handlePlayBot() {
    const myRating = (myRatingQuery.data ?? 1200) as number;
    const bot = nearestBot(myRating, "free");
    void handleCancel();
    navigate({ to: "/", search: { bot: bot.id } as never });
    toast.success(`Starting practice vs ${bot.name} (${bot.rating}).`);
  }

  const myRatingQuery = useQuery({
    queryKey: ["my-rating", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("rating").eq("id", user!.id).single();
      return data?.rating ?? 1200;
    },
  });

  const leaderboardQuery = useQuery({
    queryKey: ["leaderboard", "top10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, rating, games_played, wins")
        .order("rating", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const win = windowAt(elapsed);
  const secs = Math.floor(elapsed / 1000);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <GuestUpgradeBanner />
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight">Lobby</h1>
          <p className="mt-1 text-muted-foreground">Pick a time control and we'll match you with a player of similar rating.</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold"><Swords className="h-5 w-5 text-primary" /> Find a game</h2>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                {(["standard", "chess960"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariant(v)}
                    disabled={!!searching}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${variant === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"} disabled:opacity-50`}
                  >
                    {v === "standard" ? "Standard" : "Chess960"}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRegion(r.id)}
                    disabled={!!searching}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${region === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"} disabled:opacity-50`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {TIME_CONTROLS.map((tc) => {
                const isSearching = searching === tc.id;
                return (
                  <button
                    key={tc.id}
                    onClick={() => isSearching ? handleCancel() : handleFind(tc.id)}
                    disabled={searching !== null && !isSearching}
                    className={`group rounded-2xl border-2 p-6 text-left transition ${
                      isSearching ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/60 hover:shadow-md"
                    } disabled:opacity-40`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{tc.label}</p>
                        <p className="mt-1 font-serif text-3xl font-bold">{tc.sub}</p>
                      </div>
                      {isSearching ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Searching
                          <X className="ml-1 h-3 w-3" />
                        </div>
                      ) : (
                        <span className="text-2xl text-muted-foreground group-hover:text-primary">→</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {searching && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      Queued for <span className="font-semibold">{searching}</span> · {variant} · {REGIONS.find((r) => r.id === region)?.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{secs}s</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rating window ±{win}{secs >= 30 ? " (expanded)" : ""}. Click the card to cancel.
                  </p>
                </div>

                {showBotOffer && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <span>Still searching — want to warm up against a bot of your level?</span>
                    </div>
                    <button
                      onClick={handlePlayBot}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Play bot
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          <aside>
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold"><Trophy className="h-5 w-5 text-accent" /> Top 10</h2>
            <div className="rounded-2xl border border-border bg-card p-2">
              {leaderboardQuery.data?.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 text-right text-sm font-bold ${i < 3 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span>
                    <span className="font-medium">{p.username}</span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-primary">{p.rating}</span>
                </div>
              ))}
              {leaderboardQuery.data?.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">No ranked players yet — be the first!</p>
              )}
            </div>
            <Link to="/leaderboard" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">View full leaderboard →</Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
