import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Trophy, Swords, UserPlus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { getMyFeed, getMyFriends } from "@/lib/social.functions";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Feed — Hamduk Chess" },
      { name: "description", content: "Activity from players you follow on Hamduk Chess." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_320px]">
        <Activity />
        <Friends />
      </main>
    </div>
  );
}

function Activity() {
  const fetchFeed = useServerFn(getMyFeed);
  const { data, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(),
  });

  return (
    <section>
      <h1 className="mb-4 font-serif text-2xl font-bold">Following feed</h1>
      <div className="space-y-3">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Your feed is quiet.</p>
            <p className="mt-1 text-sm">
              Follow players from the{" "}
              <Link to="/leaderboard" className="text-primary underline">
                leaderboard
              </Link>{" "}
              to see their games and milestones here.
            </p>
          </div>
        )}
        {data?.items.map((it) => (
          <article
            key={it.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {iconFor(it.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link
                  to="/profile/$username"
                  params={{ username: it.username }}
                  className="font-semibold hover:underline"
                >
                  {it.username}
                </Link>{" "}
                <span className="text-muted-foreground">{describe(it.type, it.payload)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(it.createdAt).toLocaleString()}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function iconFor(type: string) {
  if (type.startsWith("game")) return <Swords className="h-4 w-4" />;
  if (type.includes("achievement") || type.includes("milestone"))
    return <Trophy className="h-4 w-4" />;
  return <UserPlus className="h-4 w-4" />;
}

function describe(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "game_won":
      return `won a game${p.opponent ? ` against ${p.opponent}` : ""}.`;
    case "rating_milestone":
      return `reached ${p.rating} rating.`;
    case "achievement":
      return `unlocked “${p.name ?? "an achievement"}”.`;
    case "followed":
      return `followed ${p.target ?? "someone"}.`;
    default:
      return type.replace(/_/g, " ");
  }
}

function Friends() {
  const fetchFriends = useServerFn(getMyFriends);
  const { data } = useQuery({
    queryKey: ["friends"],
    queryFn: () => fetchFriends(),
  });

  return (
    <aside className="space-y-6">
      <FriendBlock title={`Incoming (${data?.incoming.length ?? 0})`} list={data?.incoming} kind="incoming" />
      <FriendBlock title={`Friends (${data?.accepted.length ?? 0})`} list={data?.accepted} kind="accepted" />
      <FriendBlock title={`Pending (${data?.outgoing.length ?? 0})`} list={data?.outgoing} kind="outgoing" />
    </aside>
  );
}

function FriendBlock({
  title,
  list,
  kind,
}: {
  title: string;
  list?: { id: string; userId: string; username?: string; rating?: number }[];
  kind: "incoming" | "accepted" | "outgoing";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 font-serif text-base font-bold">{title}</h2>
      {(list?.length ?? 0) === 0 && (
        <p className="text-xs text-muted-foreground">Nothing here.</p>
      )}
      <ul className="space-y-2">
        {list?.map((f) => (
          <li key={f.id} className="flex items-center justify-between text-sm">
            <Link
              to="/profile/$username"
              params={{ username: f.username ?? "" }}
              className="font-medium hover:underline"
            >
              {f.username ?? "unknown"}
            </Link>
            {kind === "accepted" && (
              <Link
                to="/messages"
                search={{ with: f.username }}
                className="text-xs text-primary hover:underline"
              >
                Message
              </Link>
            )}
            {kind === "incoming" && (
              <span className="text-xs text-muted-foreground">view profile to accept</span>
            )}
            {kind === "outgoing" && (
              <span className="text-xs text-muted-foreground">pending</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
