import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy, Calendar, Flag, UserPlus, UserCheck, UserMinus, MessageSquare, Check, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { getProfileByUsername } from "@/lib/profile.functions";
import {
  followUser,
  unfollowUser,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getRelation,
} from "@/lib/social.functions";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Hamduk Chess` },
      { name: "description", content: `${params.username}'s rating, stats, and recent games on Hamduk Chess.` },
      { property: "og:title", content: `${params.username} — Hamduk Chess` },
      { property: "og:description", content: `${params.username}'s rating, stats, and recent games on Hamduk Chess.` },
    ],
  }),
  component: ProfilePage,
  errorComponent: ProfileError,
  notFoundComponent: () => <NotFound username="" />,
});

function ProfileError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Could not load profile</h1>
        <button
          onClick={() => { reset(); router.invalidate(); }}
          className="mt-4 rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Retry
        </button>
      </main>
    </div>
  );
}

function NotFound({ username }: { username: string }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Player not found</h1>
        <p className="mt-2 text-muted-foreground">No player named "{username}" on Hamduk.</p>
        <Link to="/leaderboard" className="mt-4 inline-block text-sm text-primary underline">
          Back to leaderboard
        </Link>
      </main>
    </div>
  );
}

function ProfilePage() {
  const { username } = Route.useParams();
  const fetchProfile = useServerFn(getProfileByUsername);
  const { data, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!data?.profile) return <NotFound username={username} />;

  const p = data.profile;
  const winRate = p.games_played > 0 ? Math.round((p.wins / p.games_played) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
                {p.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="font-serif text-3xl font-bold tracking-tight">{p.username}</h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Flag className="h-3.5 w-3.5" /> {p.country ?? "NG"}
                  <span>·</span>
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-accent/30 px-4 py-3">
              <Trophy className="h-5 w-5 text-accent" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rank #{data.rank}</p>
                <p className="font-mono text-2xl font-bold text-primary">{p.rating}</p>
              </div>
            </div>
          </div>

          <SocialActions targetId={p.id} targetUsername={p.username} />

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Games" value={p.games_played} />
            <Stat label="Wins" value={p.wins} accent="text-emerald-600" />
            <Stat label="Losses" value={p.losses} accent="text-rose-600" />
            <Stat label="Win rate" value={`${winRate}%`} />
          </div>
        </header>

        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-bold">Recent games</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Time</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Moves</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.games.map((g) => (
                  <tr key={g.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <OutcomeBadge outcome={g.outcome} color={g.color} />
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/profile/$username" params={{ username: g.opponent }} className="font-medium hover:underline">
                        {g.opponent}
                      </Link>
                      <span className="ml-1 text-xs text-muted-foreground">({g.opponentRating})</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{g.timeControl}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{Math.ceil(g.ply / 2)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(g.endedAt ?? g.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {data.games.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No games played yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-xl font-bold ${accent ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function OutcomeBadge({ outcome, color }: { outcome: "win" | "loss" | "draw" | "ongoing"; color: string }) {
  const styles: Record<typeof outcome, string> = {
    win: "bg-emerald-100 text-emerald-800",
    loss: "bg-rose-100 text-rose-800",
    draw: "bg-zinc-200 text-zinc-800",
    ongoing: "bg-amber-100 text-amber-800",
  };
  const label = outcome === "ongoing" ? "Live" : outcome[0].toUpperCase() + outcome.slice(1);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold ${styles[outcome]}`}>
      {label}
      <span className="font-normal text-[10px] opacity-70">· {color === "white" ? "♔" : "♚"}</span>
    </span>
  );
}
