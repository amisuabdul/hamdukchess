import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, Pager, PageHeader, when } from "@/components/admin/AdminUi";
import { listAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit log | Hamduk Chess staff" },
      { name: "description", content: "Every staff action taken in the Hamduk Chess console." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAuditLog,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [since, setSince] = useState("");

  const log = useQuery({
    queryKey: ["admin-audit", page, action, since],
    queryFn: () =>
      listAuditLog({
        data: {
          page,
          pageSize: 30,
          action: action || undefined,
          since: since ? new Date(since).toISOString() : undefined,
        },
      }),
  });

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Immutable record of every staff action." />
      <Card className="mb-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by action, e.g. user.ban"
            className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={since}
            onChange={(e) => {
              setSince(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </Card>
      <Card>
        {log.isLoading ? (
          <EmptyState>Loading log…</EmptyState>
        ) : !log.data?.entries.length ? (
          <EmptyState>No entries match those filters.</EmptyState>
        ) : (
          <div className="space-y-2 text-sm">
            {log.data.entries.map((e) => (
              <div key={e.id} className="border-b border-border pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{e.action}</span>{" "}
                    <span className="text-muted-foreground">
                      by {e.adminName}
                      {e.target_table ? ` on ${e.target_table}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{when(e.created_at)}</span>
                </div>
                {e.reason ? <p className="mt-1 text-xs text-muted-foreground">Reason: {e.reason}</p> : null}
                {e.target_id ? <p className="text-xs font-mono text-muted-foreground">{e.target_id}</p> : null}
              </div>
            ))}
          </div>
        )}
        <Pager page={page} pageSize={30} total={log.data?.total ?? 0} onPage={setPage} />
      </Card>
    </div>
  );
}
