import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Card, EmptyState, Pager, PageHeader, Pill, when } from "@/components/admin/AdminUi";
import { listUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users/")({
  head: () => ({
    meta: [
      { title: "User management | Hamduk Chess staff" },
      { name: "description", content: "Search, filter and moderate Hamduk Chess player accounts." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminUsers,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

const PAGE_SIZE = 25;

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "banned" | "guest">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "last_active_at" | "rating" | "games_played">("created_at");
  const [page, setPage] = useState(1);

  const users = useQuery({
    queryKey: ["admin-users", search, tier, status, sortBy, page],
    queryFn: () =>
      listUsers({ data: { search: search || undefined, tier, status, sortBy, page, pageSize: PAGE_SIZE } }),
  });

  return (
    <div>
      <PageHeader title="Users" subtitle="Search accounts, review status and open a profile to take action." />

      <Card className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search username"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All tiers</option>
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="gold">Gold</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="guest">Guests</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="created_at">Newest</option>
            <option value="last_active_at">Last active</option>
            <option value="rating">Rating</option>
            <option value="games_played">Games played</option>
          </select>
        </div>
      </Card>

      <Card>
        {users.isLoading ? (
          <EmptyState>Loading users…</EmptyState>
        ) : !users.data?.users.length ? (
          <EmptyState>No accounts match those filters.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2 pr-3">Rating</th>
                  <th className="py-2 pr-3">Games</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: u.id }}
                        className="font-medium hover:underline"
                      >
                        {u.username}
                      </Link>
                      {u.adminRole ? (
                        <span className="ml-2">
                          <Pill tone="good">{String(u.adminRole).replace("_", " ")}</Pill>
                        </span>
                      ) : null}
                      {u.is_org ? (
                        <span className="ml-2">
                          <Pill>org</Pill>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 capitalize">{u.subscription_tier}</td>
                    <td className="py-2 pr-3">{u.rating}</td>
                    <td className="py-2 pr-3">{u.games_played}</td>
                    <td className="py-2 pr-3">
                      {u.banned_at ? (
                        <Pill tone="bad">banned</Pill>
                      ) : u.is_guest ? (
                        <Pill>guest</Pill>
                      ) : (
                        <Pill tone="good">active</Pill>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{when(u.last_active_at)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{when(u.created_at)}</td>
                    <td className="py-2 text-right">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: u.id }}
                        className="text-primary hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={PAGE_SIZE} total={users.data?.total ?? 0} onPage={setPage} />
      </Card>
    </div>
  );
}
