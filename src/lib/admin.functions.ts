// Admin dashboard server functions.
// Every function is gated by requireAdminRole(), which reads public.admin_roles
// with the service-role client on every call. Mutations are rate limited and
// written to admin_audit_log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminRole } from "@/lib/admin-middleware";

const RoleEnum = z.enum(["super_admin", "admin", "moderator", "support"]);
const TierEnum = z.enum(["free", "plus", "gold"]);

/** UI-only: tells the client whether to render the admin shell. Not authorization. */
export const getMyAdminRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lookupAdminRole } = await import("@/lib/admin-middleware");
    return { role: await lookupAdminRole(context.userId) };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .handler(async () => {
    const { computeAdminStats, fetchRecentActivity } = await import("@/lib/admin.server");
    const [stats, recent] = await Promise.all([computeAdminStats(), fetchRecentActivity()]);
    return { stats, recent };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().max(60).optional(),
        tier: z.string().optional(),
        status: z.enum(["all", "active", "banned", "guest"]).default("all"),
        sortBy: z.enum(["created_at", "last_active_at", "rating", "games_played"]).default("created_at"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchUsers } = await import("@/lib/admin.server");
    return fetchUsers(data);
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { fetchUserDetail } = await import("@/lib/admin.server");
    return fetchUserDetail(data.userId);
  });

export const banUser = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        reason: z.string().min(3).max(500),
        until: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_ban", 20, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction, abortActiveGames } = await import("@/lib/admin.server");

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, username, banned_at, banned_reason, suspended_until")
      .eq("id", data.userId)
      .maybeSingle();
    if (!before) throw new Error("User not found");

    const patch = {
      banned_at: new Date().toISOString(),
      banned_reason: data.reason,
      banned_by: context.userId,
      suspended_until: data.until ?? null,
    };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);

    const aborted = await abortActiveGames(data.userId, "admin_ban");
    try {
      await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    } catch (err) {
      console.error("[admin] session revoke failed", err);
    }

    await logAdminAction({
      adminId: context.userId,
      action: data.until ? "user.suspend" : "user.ban",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: patch,
      reason: data.reason,
    });
    return { ok: true, abortedGames: aborted };
  });

export const unbanUser = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, username, banned_at, banned_reason, suspended_until")
      .eq("id", data.userId)
      .maybeSingle();
    const patch = { banned_at: null, banned_reason: null, banned_by: null, suspended_until: null };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: "user.unban",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: patch,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const adjustUserRating = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        newRating: z.number().int().min(400).max(3500),
        reason: z.string().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_rating", 50, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, username, rating")
      .eq("id", data.userId)
      .maybeSingle();
    if (!before) throw new Error("User not found");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ rating: data.newRating })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: "user.rating_override",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: { rating: data.newRating },
      reason: data.reason,
    });
    return { ok: true };
  });

export const grantSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        tier: TierEnum,
        expiresAt: z.string().datetime().optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_grant", 60, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, username, subscription_tier, subscription_status, subscription_renews_at")
      .eq("id", data.userId)
      .maybeSingle();
    if (!before) throw new Error("User not found");
    const patch = {
      subscription_tier: data.tier,
      subscription_status: data.tier === "free" ? "none" : "comped",
      subscription_renews_at: data.expiresAt ?? null,
    };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: "subscription.grant",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: patch,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const revokeSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, username, subscription_tier, subscription_status")
      .eq("id", data.userId)
      .maybeSingle();
    const patch = {
      subscription_tier: "free" as const,
      subscription_status: "cancelled",
      subscription_renews_at: null,
    };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: "subscription.revoke",
      targetTable: "profiles",
      targetId: data.userId,
      before,
      after: patch,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/** super_admin only — hard delete, cascades through FKs. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("super_admin")])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        confirmUsername: z.string().min(1),
        reason: z.string().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_delete", 10, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");

    if (data.userId === context.userId) throw new Error("You cannot delete your own account here.");
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .maybeSingle();
    if (!before) throw new Error("User not found");
    if (before.username.toLowerCase() !== data.confirmUsername.trim().toLowerCase()) {
      throw new Error("Confirmation text does not match the username.");
    }

    await logAdminAction({
      adminId: context.userId,
      action: "user.delete",
      targetTable: "auth.users",
      targetId: data.userId,
      before: before as never,
      after: null,
      reason: data.reason,
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** super_admin only — manage the staff roster. */
export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("super_admin")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: RoleEnum, reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_role", 20, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");

    const { data: before } = await supabaseAdmin
      .from("admin_roles")
      .select("user_id, role")
      .eq("user_id", data.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("admin_roles")
      .upsert(
        { user_id: data.userId, role: data.role, granted_by: context.userId },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await logAdminAction({
      adminId: context.userId,
      action: "admin_role.set",
      targetTable: "admin_roles",
      targetId: data.userId,
      before,
      after: { role: data.role },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const revokeAdminRole = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("super_admin")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    if (data.userId === context.userId) {
      throw new Error("You cannot revoke your own super admin role.");
    }
    const { data: before } = await supabaseAdmin
      .from("admin_roles")
      .select("user_id, role")
      .eq("user_id", data.userId)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("admin_roles").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: "admin_role.revoke",
      targetTable: "admin_roles",
      targetId: data.userId,
      before,
      after: null,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const listAdminRoster = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("super_admin")])
  .handler(async () => {
    const { fetchAdminRoster } = await import("@/lib/admin.server");
    return fetchAdminRoster();
  });

export const lookupUserByUsername = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) => z.object({ username: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { findProfileByUsername } = await import("@/lib/admin.server");
    return { profile: await findProfileByUsername(data.username) };
  });

export const listFlaggedGames = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) => z.object({ page: z.number().int().min(1).default(1) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { fetchFlaggedGames } = await import("@/lib/admin.server");
    return fetchFlaggedGames(data.page);
  });

export const getGameDetail = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { fetchGameDetail } = await import("@/lib/admin.server");
    return fetchGameDetail(data.gameId);
  });

export const reviewGame = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        gameId: z.string().uuid(),
        verdict: z.enum(["clear", "confirmed_cheat"]),
        reason: z.string().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_review", 120, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");

    const { data: before } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, flagged_for_review, flag_reason")
      .eq("id", data.gameId)
      .maybeSingle();
    if (!before) throw new Error("Game not found");

    const patch =
      data.verdict === "clear"
        ? { flagged_for_review: false, flag_reason: null }
        : { flagged_for_review: true, flag_reason: `confirmed_cheat: ${data.reason}` };
    const { error } = await supabaseAdmin.from("games").update(patch).eq("id", data.gameId);
    if (error) throw new Error(error.message);

    if (data.verdict === "confirmed_cheat") {
      await supabaseAdmin
        .from("profiles")
        .update({ flagged_for_review: true, flag_reason: `confirmed_cheat in game ${data.gameId}` })
        .in("id", [before.white_id, before.black_id]);
    }

    await logAdminAction({
      adminId: context.userId,
      action: `game.review.${data.verdict}`,
      targetTable: "games",
      targetId: data.gameId,
      before,
      after: patch,
      reason: data.reason,
    });
    return { ok: true };
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(25),
        status: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchPayments } = await import("@/lib/admin.server");
    return fetchPayments(data);
  });

export const getRevenueBreakdown = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) => z.object({ days: z.number().int().min(7).max(365).default(30) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { fetchRevenueBreakdown } = await import("@/lib/admin.server");
    return fetchRevenueBreakdown(data.days);
  });

/** No refund button: flag the payment for manual follow-up in Paystack instead. */
export const flagPayment = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid(), note: z.string().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    const { data: before } = await supabaseAdmin
      .from("payment_events")
      .select("id, user_id, event, reference, amount")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!before) throw new Error("Payment event not found");
    await logAdminAction({
      adminId: context.userId,
      action: "payment.flag_for_followup",
      targetTable: "payment_events",
      targetId: data.paymentId,
      before,
      after: null,
      reason: data.note,
    });
    return { ok: true };
  });

export const listCoaches = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) =>
    z.object({ status: z.enum(["all", "pending", "active", "inactive"]).default("all") }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchCoaches } = await import("@/lib/admin.server");
    return fetchCoaches(data.status);
  });

export const setCoachActive = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("admin")])
  .inputValidator((d) =>
    z
      .object({ coachId: z.string().uuid(), active: z.boolean(), reason: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_coach", 60, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    const { data: before } = await supabaseAdmin
      .from("coach_profiles")
      .select("id, display_name, is_active")
      .eq("id", data.coachId)
      .maybeSingle();
    if (!before) throw new Error("Coach not found");
    const { error } = await supabaseAdmin
      .from("coach_profiles")
      .update({ is_active: data.active })
      .eq("id", data.coachId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: data.active ? "coach.approve" : "coach.deactivate",
      targetTable: "coach_profiles",
      targetId: data.coachId,
      before,
      after: { is_active: data.active },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const listOrgs = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .handler(async () => {
    const { fetchOrgs } = await import("@/lib/admin.server");
    return fetchOrgs();
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "open", "resolved", "dismissed"]).default("open"),
        page: z.number().int().min(1).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchReports } = await import("@/lib/admin.server");
    return fetchReports(data.status, data.page);
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([requireAdminRole("moderator")])
  .inputValidator((d) =>
    z
      .object({
        reportId: z.string().uuid(),
        status: z.enum(["resolved", "dismissed"]),
        note: z.string().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertRate } = await import("@/lib/rate-limit.server");
    await assertRate(context.userId, "admin_report", 200, 3600);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAdminAction } = await import("@/lib/admin.server");
    const { data: before } = await supabaseAdmin
      .from("reports")
      .select("id, status, target_type, target_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!before) throw new Error("Report not found");
    const patch = {
      status: data.status,
      resolution_note: data.note,
      resolved_by: context.userId,
      resolved_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("reports").update(patch).eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await logAdminAction({
      adminId: context.userId,
      action: `report.${data.status}`,
      targetTable: "reports",
      targetId: data.reportId,
      before,
      after: patch,
      reason: data.note,
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("support")])
  .inputValidator((d) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(100).default(30),
        action: z.string().max(60).optional(),
        adminId: z.string().uuid().optional(),
        since: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { fetchAuditLog } = await import("@/lib/admin.server");
    return fetchAuditLog(data);
  });

export const listAllApiKeys = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("admin")])
  .handler(async () => {
    const { fetchAllApiKeys } = await import("@/lib/admin.server");
    return fetchAllApiKeys();
  });

export const listAllWebhooks = createServerFn({ method: "GET" })
  .middleware([requireAdminRole("admin")])
  .handler(async () => {
    const { fetchAllWebhooks } = await import("@/lib/admin.server");
    return fetchAllWebhooks();
  });
