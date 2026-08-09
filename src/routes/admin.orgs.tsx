import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import { listOrgs } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/orgs")({
  head: () => ({
    meta: [
      { title: "Organisations | Hamduk Chess staff" },
      { name: "description", content: "Clubs, schools and academies with their members and tournaments." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminOrgs,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminOrgs() {
  const orgs = useQuery({ queryKey: ["admin-orgs"], queryFn: () => listOrgs() });

  return (
    <div>
      <PageHeader title="Organisations" subtitle="Org owners, linked members and tournament activity." />
      {orgs.isLoading ? (
        <EmptyState>Loading organisations…</EmptyState>
      ) : !orgs.data?.orgs.length ? (
        <Card>
          <EmptyState>No organisation accounts yet.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {orgs.data.orgs.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{o.username}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.memberCount} member{o.memberCount === 1 ? "" : "s"} · {o.tournaments.length} tournament
                    {o.tournaments.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={o.subscription_tier === "gold" ? "good" : "muted"}>{o.subscription_tier}</Pill>
                  {o.is_org ? <Pill tone="good">org</Pill> : null}
                </div>
              </div>
              {o.tournaments.length ? (
                <div className="mt-3 space-y-1 text-sm">
                  {o.tournaments.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {t.name} · {t.format} · round {t.current_round}/{t.rounds} · {t.status}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{when(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
