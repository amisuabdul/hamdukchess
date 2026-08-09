import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, EmptyState, Pager, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import { listFlaggedGames, reviewGame } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/games")({
  head: () => ({
    meta: [
      { title: "Anti-cheat queue | Hamduk Chess staff" },
      { name: "description", content: "Review games flagged by the anti-cheat system." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminGames,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminGames() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const games = useQuery({ queryKey: ["admin-flagged", page], queryFn: () => listFlaggedGames({ data: { page } }) });

  const review = useMutation({
    mutationFn: (v: { gameId: string; verdict: "clear" | "confirmed_cheat"; reason: string }) =>
      reviewGame({ data: v }),
    onSuccess: () => {
      toast.success("Verdict recorded");
      qc.invalidateQueries({ queryKey: ["admin-flagged"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = (gameId: string, verdict: "clear" | "confirmed_cheat") => {
    const reason = reasons[gameId] ?? "";
    if (reason.trim().length < 3) {
      toast.error("Add a short note — it goes into the audit log.");
      return;
    }
    review.mutate({ gameId, verdict, reason });
  };

  return (
    <div>
      <PageHeader title="Games & anti-cheat" subtitle="Games flagged for manual review, newest first." />
      {games.isLoading ? (
        <EmptyState>Loading queue…</EmptyState>
      ) : !games.data?.games.length ? (
        <Card>
          <EmptyState>Queue is empty — nothing flagged.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {games.data.games.map((g) => (
            <Card key={g.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {g.whiteName} <span className="text-muted-foreground">vs</span> {g.blackName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {g.time_control} · {g.variant} · {g.ply} plies · {g.status}
                    {g.result ? ` · ${g.result}` : ""} · {when(g.created_at)}
                  </p>
                </div>
                <Pill tone="warn">{g.flag_reason ?? "flagged"}</Pill>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={reasons[g.id] ?? ""}
                  onChange={(e) => setReasons((r) => ({ ...r, [g.id]: e.target.value }))}
                  placeholder="Review note"
                  className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => act(g.id, "clear")}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Clear flag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Confirm cheating? Both players will be flagged for follow-up.")) return;
                    act(g.id, "confirmed_cheat");
                  }}
                  className="rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground"
                >
                  Confirm cheating
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pager page={page} pageSize={20} total={games.data?.total ?? 0} onPage={setPage} />
    </div>
  );
}
