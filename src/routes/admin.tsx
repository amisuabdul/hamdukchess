import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Building2,
  CreditCard,
  Flag,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getMyAdminRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff console | Hamduk Chess" },
      { name: "description", content: "Internal staff console for Hamduk Chess operations." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Not found</div>,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/games", label: "Games & anti-cheat", icon: Activity },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/coaches", label: "Coaches", icon: BadgeCheck },
  { to: "/admin/orgs", label: "Organisations", icon: Building2 },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const role = useQuery({
    queryKey: ["my-admin-role"],
    queryFn: () => getMyAdminRole(),
    enabled: Boolean(user),
    retry: false,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (role.isSuccess && !role.data.role) {
      toast.error("You do not have access to the staff console.");
      navigate({ to: "/" });
    }
    if (role.isError) {
      navigate({ to: "/" });
    }
  }, [loading, user, role.isSuccess, role.isError, role.data?.role, navigate]);

  if (loading || role.isLoading || !role.data?.role) {
    return <div className="p-8 text-sm text-muted-foreground">Checking staff access…</div>;
  }

  const isSuper = role.data.role === "super_admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-6">
        <aside className="md:w-56 md:shrink-0">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center gap-2 px-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <p className="font-serif text-sm leading-none">Staff console</p>
                <p className="mt-1 text-xs text-muted-foreground">{role.data.role.replace("_", " ")}</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {[...NAV, ...(isSuper ? [{ to: "/admin/roles", label: "Admin roles", icon: ShieldCheck }] : [])].map(
                (item) => {
                  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                },
              )}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
