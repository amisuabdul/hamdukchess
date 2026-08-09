import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader, Pill, naira, when } from "@/components/admin/AdminUi";
import { listCoaches, setCoachActive } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/coaches")({
  head: () => ({
    meta: [
      { title: "Coach approvals | Hamduk Chess staff" },
      { name: "description", content: "Approve, review and deactivate coach profiles." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminCoaches,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminCoaches() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | "pending" | "active">("pending");
  const coaches = useQuery({ queryKey: ["admin-coaches", status], queryFn: () => listCoaches({ data: { status } }) });

  const toggle = useMutation({
    mutationFn: (v: { coachId: string; active: boolean; reason?: string }) => setCoachActive({ data: v }),
    onSuccess: () => {
      toast.success("Coach updated");
      qc.invalidateQueries({ queryKey: ["admin-coaches"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Coaches"
        subtitle="Approval queue and active coach roster."
        action={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="pending">Awaiting approval</option>
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
        }
      />
      {coaches.isLoading ? (
        <EmptyState>Loading coaches…</EmptyState>
      ) : !coaches.data?.coaches.length ? (
        <Card>
          <EmptyState>No coach profiles in this view.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coaches.data.coaches.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {c.fide_title ? `${c.fide_title} ` : ""}
                    {c.display_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {naira(c.hourly_rate_kobo / 100)}/hr · {c.sessions_completed} sessions ·{" "}
                    {c.rating_count ? `${c.avg_rating}★ (${c.rating_count})` : "no reviews"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Joined {when(c.created_at)}</p>
                </div>
                <Pill tone={c.is_active ? "good" : "warn"}>{c.is_active ? "active" : "pending"}</Pill>
              </div>
              {c.specialties?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.specialties.map((s: string) => (
                    <Pill key={s}>{s}</Pill>
                  ))}
                </div>
              ) : null}
              <div className="mt-3">
                {c.is_active ? (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = prompt("Reason for deactivating this coach?") ?? "";
                      if (reason.trim().length < 3) return;
                      toggle.mutate({ coachId: c.id, active: false, reason });
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ coachId: c.id, active: true })}
                    className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  >
                    Approve coach
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
