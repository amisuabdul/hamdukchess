import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Ban, ShieldCheck, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Card, EmptyState, PageHeader, Pill, naira, when } from "@/components/admin/AdminUi";
import {
  adjustUserRating,
  banUser,
  deleteUserAccount,
  getMyAdminRole,
  getUserDetail,
  grantSubscription,
  revokeAdminRole,
  revokeSubscription,
  setAdminRole,
  unbanUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({
    meta: [
      { title: "Account detail | Hamduk Chess staff" },
      { name: "description", content: "Full account history, moderation and subscription controls." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUserDetail,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Account not found</div>,
});

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const role = useQuery({ queryKey: ["my-admin-role"], queryFn: () => getMyAdminRole() });
  const detail = useQuery({ queryKey: ["admin-user", userId], queryFn: () => getUserDetail({ data: { userId } }) });

  const [reason, setReason] = useState("");
  const [newRating, setNewRating] = useState("");
  const [tier, setTier] = useState<"free" | "plus" | "gold">("plus");
  const [confirmName, setConfirmName] = useState("");
  const [staffRole, setStaffRole] = useState<"admin" | "moderator" | "support" | "super_admin">("moderator");

  const isSuper = role.data?.role === "super_admin";
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-user", userId] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    setReason("");
  };

  const need = () => {
    if (reason.trim().length < 3) {
      toast.error("Enter a reason first — it goes into the audit log.");
      return false;
    }
    return true;
  };

  const ban = useMutation({
    mutationFn: () => banUser({ data: { userId, reason } }),
    onSuccess: (r) => {
      toast.success(`Account banned${r.abortedGames ? ` · ${r.abortedGames} game(s) aborted` : ""}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unban = useMutation({
    mutationFn: () => unbanUser({ data: { userId, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Ban lifted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rating = useMutation({
    mutationFn: () => adjustUserRating({ data: { userId, newRating: Number(newRating), reason } }),
    onSuccess: () => {
      toast.success("Rating overridden");
      setNewRating("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const grant = useMutation({
    mutationFn: () => grantSubscription({ data: { userId, tier, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Subscription granted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: () => revokeSubscription({ data: { userId, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Subscription revoked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteUserAccount({ data: { userId, confirmUsername: confirmName, reason } }),
    onSuccess: () => toast.success("Account deleted"),
    onError: (e: Error) => toast.error(e.message),
  });
  const grantStaff = useMutation({
    mutationFn: () => setAdminRole({ data: { userId, role: staffRole, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Staff role updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeStaff = useMutation({
    mutationFn: () => revokeAdminRole({ data: { userId, reason: reason || undefined } }),
    onSuccess: () => {
      toast.success("Staff role revoked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) return <EmptyState>Loading account…</EmptyState>;
  if (!detail.data) return <EmptyState>Account not found.</EmptyState>;
  const d = detail.data;

  return (
    <div>
      <Link to="/admin/users" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>
      <PageHeader
        title={d.profile.username}
        subtitle={`${d.email ?? "no email"} · joined ${when(d.profile.created_at)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={d.profile.subscription_tier === "free" ? "muted" : "good"}>
              {d.profile.subscription_tier}
            </Pill>
            {d.profile.banned_at ? <Pill tone="bad">banned</Pill> : <Pill tone="good">active</Pill>}
            {d.adminRole ? <Pill tone="warn">{d.adminRole.replace("_", " ")}</Pill> : null}
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-serif text-lg">Account</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Rating</dt>
              <dd>{d.profile.rating}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Record</dt>
              <dd>
                {d.profile.wins}W / {d.profile.losses}L / {d.profile.draws}D
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Games</dt>
              <dd>{d.profile.games_played}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Country</dt>
              <dd>{d.profile.country ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last active</dt>
              <dd>{when(d.profile.last_active_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last sign in</dt>
              <dd>{when(d.lastSignInAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Guest</dt>
              <dd>{d.profile.is_guest ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Organisation</dt>
              <dd>{d.profile.is_org ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Subscription status</dt>
              <dd>{d.profile.subscription_status}</dd>
            </div>
          </dl>
          {d.profile.banned_at ? (
            <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Banned {when(d.profile.banned_at)} — {d.profile.banned_reason ?? "no reason recorded"}
              {d.profile.suspended_until ? ` · until ${when(d.profile.suspended_until)}` : ""}
            </p>
          ) : null}
          {d.profile.flagged_for_review ? (
            <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              Flagged for anti-cheat review: {d.profile.flag_reason ?? "no reason recorded"}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="font-serif text-lg">Actions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every action below is written to the audit log with your reason.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (required for ban, rating override and deletion)"
            className="mt-3 w-full rounded-lg border border-border bg-background p-2 text-sm"
          />

          <div className="mt-3 space-y-2">
            {d.profile.banned_at ? (
              <button
                type="button"
                onClick={() => unban.mutate()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <Undo2 className="h-4 w-4" /> Lift ban
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!need()) return;
                  if (!confirm(`Ban ${d.profile.username}? Active games will be aborted and sessions revoked.`)) return;
                  ban.mutate();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground"
              >
                <Ban className="h-4 w-4" /> Ban account
              </button>
            )}

            <div className="flex gap-2">
              <input
                value={newRating}
                onChange={(e) => setNewRating(e.target.value)}
                inputMode="numeric"
                placeholder="New rating"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!newRating}
                onClick={() => {
                  if (!need()) return;
                  rating.mutate();
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
              >
                Override
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as typeof tier)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="free">Free</option>
                <option value="plus">Plus</option>
                <option value="gold">Gold</option>
              </select>
              <button
                type="button"
                onClick={() => grant.mutate()}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <Sparkles className="h-4 w-4" /> Grant
              </button>
            </div>
            <button
              type="button"
              onClick={() => revoke.mutate()}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              Revoke subscription
            </button>
          </div>

          {isSuper ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="flex items-center gap-1 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" /> Staff role
              </p>
              <div className="mt-2 flex gap-2">
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as typeof staffRole)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="support">Support</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Grant ${staffRole} to ${d.profile.username}?`)) return;
                    grantStaff.mutate();
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Set
                </button>
              </div>
              {d.adminRole ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Revoke staff access from ${d.profile.username}?`)) return;
                    revokeStaff.mutate();
                  }}
                  className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Revoke staff access
                </button>
              ) : null}

              <div className="mt-4 rounded-lg border border-destructive/40 p-3">
                <p className="text-sm font-medium text-destructive">Delete account permanently</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Type <span className="font-mono">{d.profile.username}</span> to confirm. This cannot be undone.
                </p>
                <input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder="Confirm username"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={confirmName.trim().toLowerCase() !== d.profile.username.toLowerCase()}
                  onClick={() => {
                    if (!need()) return;
                    if (!confirm("Permanently delete this account and all its data?")) return;
                    del.mutate();
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" /> Delete account
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-lg">Recent games</h2>
          <div className="mt-3 space-y-2 text-sm">
            {d.games.length === 0 ? (
              <EmptyState>No games yet.</EmptyState>
            ) : (
              d.games.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {g.time_control} · {g.status}
                    {g.result ? ` · ${g.result}` : ""}
                    {g.flagged_for_review ? " · flagged" : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(g.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <h2 className="font-serif text-lg">Payments</h2>
          <div className="mt-3 space-y-2 text-sm">
            {d.payments.length === 0 ? (
              <EmptyState>No payment events.</EmptyState>
            ) : (
              d.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {p.event} {p.plan_code ? `· ${p.plan_code}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {naira((p.amount ?? 0) / 100)} · {when(p.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-serif text-lg">Audit trail for this account</h2>
          <div className="mt-3 space-y-2 text-sm">
            {d.audit.length === 0 ? (
              <EmptyState>No staff actions recorded.</EmptyState>
            ) : (
              d.audit.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <span className="truncate">
                    <span className="font-medium">{a.action}</span>
                    {a.reason ? <span className="text-muted-foreground"> — {a.reason}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{when(a.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
