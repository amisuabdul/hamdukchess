import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Swords, Trophy, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { GuestUpgradeBanner } from "@/components/GuestUpgradeBanner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { findOrJoinMatch, cancelQueue } from "@/lib/matchmaking.functions";

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

function LobbyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const find = useServerFn(findOrJoinMatch);
  const cancel = useServerFn(cancelQueue);
  const [searching, setSearching] = useState<string | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Subscribe to games created with me as a participant
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
    subRef.current = channel;
    return () => { void supabase.removeChannel(channel); };
  }, [user, searching, navigate]);

  async function handleFind(tc: string) {
    setSearching(tc);
    try {
      const { gameId } = await find({ data: { timeControl: tc as "3+0" | "5+0" | "10+0" | "15+10" } });
      if (gameId) {
        navigate({ to: "/play/$gameId", params: { gameId } });
      } else {
        toast.info("Searching for an opponent…");
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <GuestUpgradeBanner />
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight">Lobby</h1>
          <p className="mt-1 text-muted-foreground">Pick a time control and we'll match you with a player of similar rating.</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold"><Swords className="h-5 w-5 text-primary" /> Find a game</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TIME_CONTROLS.map((tc) => {
                const isSearching = searching === tc.id;
                return (
                  <button
                    key={tc.id}
                    onClick={() => isSearching ? handleCancel() : handleFind(tc.id)}
                    disabled={searching !== null && !isSearching}
                    className={`group rounded-2xl border-2 p-6 text-left transition ${
                      isSearching
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/60 hover:shadow-md"
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
              <p className="mt-4 text-sm text-muted-foreground">
                You're in the queue for <span className="font-semibold text-foreground">{searching}</span>. We'll drop you into a game as soon as an opponent joins. Click the card to cancel.
              </p>
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
