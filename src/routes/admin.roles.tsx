import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import { listAdminRoster, lookupUserByUsername, revokeAdminRole, setAdminRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({
    meta: [
      { title: "Admin roles | Hamduk Chess staff" },
      { name: "description", content: "Grant and revoke staff access to the Hamduk Chess console." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoles,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminRoles() {
  const qc = useQueryClient();
  const roster = useQuery({ queryKey: ["admin-roster"], queryFn: () => listAdminRoster() });
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"super_admin" | "admin" | "moderator" | "support">("moderator");
  const [reason, setReason] = useState("");

  const grant = useMutation({
    mutationFn: async () => {
      const found = await lookupUserByUsername({ data: { username: username.trim() } });
      if (!found.profile) throw new Error("No account with that username.");
      return setAdminRole({ data: { userId: found.profile.id, role, reason: reason || undefined } });
    },
    onSuccess: () => {
      toast.success("Staff role granted");
      setUsername("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeAdminRole({ data: { userId } }),
    onSuccess: () => {
      toast.success("Staff role revoked");
      qc.invalidateQueries({ queryKey: ["admin-roster"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Admin roles" subtitle="Super-admin only. Roles are stored server-side and audited." />

      <Card className="mb-3">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <ShieldCheck className="h-4 w-4 text-primary" /> Grant access
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="support">Support</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-[160px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!username.trim() || grant.isPending}
            onClick={() => {
              if (!confirm(`Grant ${role} access to ${username}?`)) return;
              grant.mutate();
            }}
            className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
          >
            Grant role
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-lg">Current staff</h2>
        {roster.isLoading ? (
          <EmptyState>Loading roster…</EmptyState>
        ) : !roster.data?.admins.length ? (
          <EmptyState>No staff roles granted yet.</EmptyState>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {roster.data.admins.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <div>
                  <p className="font-medium">{a.username}</p>
                  <p className="text-xs text-muted-foreground">
                    granted {when(a.created_at)}
                    {a.grantedByName ? ` by ${a.grantedByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone="good">{a.role.replace("_", " ")}</Pill>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Revoke staff access from ${a.username}?`)) return;
                      revoke.mutate(a.user_id);
                    }}
                    className="rounded-lg border border-border px-3 py-1 text-sm"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
