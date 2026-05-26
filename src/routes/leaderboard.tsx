import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Hamduk Chess" },
      { name: "description", content: "Top-rated Hamduk Chess players ranked by Elo." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", "top100"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, country, rating, games_played, wins, losses, draws")
        .order("rating", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-accent" />
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">Leaderboard</h1>
            <p className="text-muted-foreground">Top 100 players by Elo rating.</p>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Games</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">W/L/D</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {data?.map((p, i) => (
                <tr key={p.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <span className={`font-bold ${i < 3 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link to="/profile/$username" params={{ username: p.username }} className="hover:underline">
                      {p.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-primary">{p.rating}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{p.games_played}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden sm:table-cell">{p.wins}/{p.losses}/{p.draws}</td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No players yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
