// Server-side RBAC gate for the admin dashboard.
// The role is ALWAYS read from public.admin_roles with the service-role client,
// never from a JWT claim, a client-supplied value or an email allowlist.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminRole = "super_admin" | "admin" | "moderator" | "support";

const RANK: Record<AdminRole, number> = {
  super_admin: 4,
  admin: 3,
  moderator: 2,
  support: 1,
};

export async function lookupAdminRole(userId: string): Promise<AdminRole | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as AdminRole | undefined) ?? null;
}

export function hasRank(role: AdminRole | null, min: AdminRole) {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/** Composes on requireSupabaseAuth and adds `adminRole` to context. */
export function requireAdminRole(minRole: AdminRole = "support") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const role = await lookupAdminRole(context.userId);
      if (!hasRank(role, minRole)) {
        throw new Error("Unauthorized: administrator access required");
      }
      return next({ context: { adminRole: role as AdminRole } });
    });
}
