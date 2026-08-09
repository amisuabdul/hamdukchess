import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Card, EmptyState, PageHeader, Pill, Stat, naira, when } from "@/components/admin/AdminUi";
import { getAdminStats, getRevenueBreakdown } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Staff overview | Hamduk Chess" },
      { name: "description", content: "Platform health, revenue and moderation queues at a glance." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOverview,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminOverview() {
  const overview = useQuery({ queryKey: ["admin-stats"], queryFn: () => getAdminStats() });
  const revenue = useQuery({
    queryKey: ["admin-revenue", 30],
    queryFn: () => getRevenueBreakdown({ data: { days: 30 } }),
  });

  const s = overview.data?.stats;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Live platform health, revenue and moderation queues." />

      {overview.isLoading ? (
        <EmptyState>Loading metrics…</EmptyState>
      ) : s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total users" value={s.totalUsers} hint={`${s.guests} guests · ${s.bannedUsers} banned`} />
            <Stat label="Active today" value={s.dau} hint={`${s.mau} active in 30 days`} />
            <Stat label="New signups" value={s.signups7} hint={`${s.signups30} in the last 30 days`} />
            <Stat label="MRR this month" value={naira(Math.round(s.mrrNaira))} hint="Successful Paystack charges" />
            <Stat label="Games today" value={s.gamesToday} hint={`${s.gamesTotal} all time`} />
            <Stat label="Games in progress" value={s.activeGames} />
            <Stat label="Flagged games" value={s.flaggedGames} hint="Awaiting anti-cheat review" />
            <Stat label="Open reports" value={s.openReports} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan mix</p>
              <div className="mt-3 space-y-2 text-sm">
                {(["free", "plus", "gold"] as const).map((t) => (
                  <div key={t} className="flex items-center justify-between">
                    <span className="capitalize">{t}</span>
                    <span className="font-medium">{s.tiers[t] ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Coaches</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Total profiles</span>
                  <span className="font-medium">{s.coaches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Awaiting approval</span>
                  <span className="font-medium">{s.pendingCoaches}</span>
                </div>
              </div>
              <Link to="/admin/coaches" className="mt-3 inline-block text-sm text-primary hover:underline">
                Open approval queue →
              </Link>
            </Card>
            <Card className="lg:col-span-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue (30 days)</p>
              <p className="mt-1 font-serif text-2xl">{naira(revenue.data?.total ?? 0)}</p>
              <div className="mt-2 h-24">
                {revenue.data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue.data.series}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v: number) => naira(v)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="naira"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card>
              <h2 className="font-serif text-lg">Recent signups</h2>
              <div className="mt-3 space-y-2 text-sm">
                {overview.data.recent.signups.length === 0 ? (
                  <EmptyState>No signups yet.</EmptyState>
                ) : (
                  overview.data.recent.signups.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2">
                      <Link to="/admin/users/$userId" params={{ userId: u.id }} className="hover:underline">
                        {u.username}
                      </Link>
                      <div className="flex items-center gap-2">
                        {u.is_guest ? <Pill>guest</Pill> : null}
                        <Pill tone={u.subscription_tier === "free" ? "muted" : "good"}>{u.subscription_tier}</Pill>
                        <span className="text-xs text-muted-foreground">{when(u.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card>
              <h2 className="font-serif text-lg">Recently flagged games</h2>
              <div className="mt-3 space-y-2 text-sm">
                {overview.data.recent.flagged.length === 0 ? (
                  <EmptyState>Nothing flagged. Nice.</EmptyState>
                ) : (
                  overview.data.recent.flagged.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-2">
                      <Link to="/admin/games" className="truncate hover:underline">
                        {g.flag_reason ?? "flagged"}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{when(g.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
