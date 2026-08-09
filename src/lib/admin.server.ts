// Server-only helpers behind the admin dashboard. Everything here uses the
// service-role client and is only reachable through requireAdminRole().
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdminRole } from "@/lib/admin-middleware";

export type Json = Record<string, unknown> | null;

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  before?: Json;
  after?: Json;
  reason?: string | null;
}) {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_id: params.adminId,
    action: params.action,
    target_table: params.targetTable ?? null,
    target_id: params.targetId ?? null,
    before: (params.before ?? null) as never,
    after: (params.after ?? null) as never,
    reason: params.reason ?? null,
  });
  if (error) console.error("[admin] audit log failed", error.message);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

async function countOf(
  table: string,
  build?: (q: ReturnType<typeof baseCount>) => unknown,
) {
  const q = baseCount(table);
  if (build) build(q);
  const { count } = (await q) as { count: number | null };
  return count ?? 0;
}

function baseCount(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabaseAdmin.from(table as any) as any).select("*", { count: "exact", head: true });
}

export async function computeAdminStats() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    dau,
    mau,
    signups7,
    signups30,
    gamesTotal,
    gamesToday,
    activeGames,
    flaggedGames,
    openReports,
    coaches,
    pendingCoaches,
    bannedUsers,
    guests,
  ] = await Promise.all([
    countOf("profiles"),
    countOf("profiles", (q) => q.gte("last_active_at", daysAgo(1))),
    countOf("profiles", (q) => q.gte("last_active_at", daysAgo(30))),
    countOf("profiles", (q) => q.gte("created_at", daysAgo(7))),
    countOf("profiles", (q) => q.gte("created_at", daysAgo(30))),
    countOf("games"),
    countOf("games", (q) => q.gte("created_at", todayStart.toISOString())),
    countOf("games", (q) => q.eq("status", "active")),
    countOf("games", (q) => q.eq("flagged_for_review", true)),
    countOf("reports", (q) => q.eq("status", "open")),
    countOf("coach_profiles"),
    countOf("coach_profiles", (q) => q.eq("is_active", false)),
    countOf("profiles", (q) => q.not("banned_at", "is", null)),
    countOf("profiles", (q) => q.eq("is_guest", true)),
  ]);

  const tiers: Record<string, number> = { free: 0, plus: 0, gold: 0 };
  for (const tier of Object.keys(tiers)) {
    tiers[tier] = await countOf("profiles", (q) => q.eq("subscription_tier", tier));
  }

  const { data: pays } = await supabaseAdmin
    .from("payment_events")
    .select("amount, event, created_at")
    .eq("event", "charge.success")
    .gte("created_at", monthStart.toISOString());
  const mrrNaira = (pays ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0) / 100;

  return {
    totalUsers,
    dau,
    mau,
    signups7,
    signups30,
    gamesTotal,
    gamesToday,
    activeGames,
    flaggedGames,
    openReports,
    coaches,
    pendingCoaches,
    bannedUsers,
    guests,
    tiers,
    mrrNaira,
  };
}

export async function fetchRecentActivity() {
  const [{ data: signups }, { data: flagged }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, username, subscription_tier, is_guest, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, flag_reason, created_at, time_control")
      .eq("flagged_for_review", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  return { signups: signups ?? [], flagged: flagged ?? [] };
}

export async function fetchUsers(opts: {
  search?: string;
  tier?: string;
  status?: string;
  sortBy?: string;
  page: number;
  pageSize: number;
}) {
  let q = supabaseAdmin
    .from("profiles")
    .select(
      "id, username, country, rating, games_played, subscription_tier, subscription_status, is_guest, is_org, banned_at, banned_reason, suspended_until, last_active_at, created_at",
      { count: "exact" },
    );

  if (opts.search) q = q.ilike("username", `%${opts.search}%`);
  if (opts.tier && opts.tier !== "all") q = q.eq("subscription_tier", opts.tier as never);
  if (opts.status === "banned") q = q.not("banned_at", "is", null);
  if (opts.status === "guest") q = q.eq("is_guest", true);
  if (opts.status === "active") q = q.is("banned_at", null);

  const sort = opts.sortBy ?? "created_at";
  q = q.order(sort, { ascending: false });

  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await q.range(from, from + opts.pageSize - 1);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((u) => u.id);
  const roles = ids.length
    ? (await supabaseAdmin.from("admin_roles").select("user_id, role").in("user_id", ids)).data ?? []
    : [];
  const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));

  return {
    users: (data ?? []).map((u) => ({ ...u, adminRole: roleMap.get(u.id) ?? null })),
    total: count ?? 0,
  };
}

export async function fetchUserDetail(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("User not found");

  const [auth, games, payments, coach, orgs, role, audit, ratings] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, status, result, end_reason, time_control, created_at, flagged_for_review")
      .or(`white_id.eq.${userId},black_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(15),
    supabaseAdmin
      .from("payment_events")
      .select("id, event, reference, amount, currency, plan_code, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabaseAdmin.from("coach_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("org_members").select("org_owner_id, role, created_at").eq("user_id", userId),
    supabaseAdmin.from("admin_roles").select("role, created_at").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("admin_audit_log")
      .select("id, admin_id, action, reason, before, after, created_at")
      .eq("target_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("ratings")
      .select("time_control, variant, rating, games_played, wins, losses, draws")
      .eq("user_id", userId),
  ]);

  return {
    profile,
    email: auth.data.user?.email ?? null,
    emailConfirmed: Boolean(auth.data.user?.email_confirmed_at),
    lastSignInAt: auth.data.user?.last_sign_in_at ?? null,
    games: games.data ?? [],
    payments: payments.data ?? [],
    coach: coach.data ?? null,
    orgs: orgs.data ?? [],
    adminRole: (role.data?.role as AdminRole | undefined) ?? null,
    audit: audit.data ?? [],
    ratings: ratings.data ?? [],
  };
}

/** Abort every in-progress game for a user so a ban can't leave games hanging. */
export async function abortActiveGames(userId: string, reason: string) {
  const { data } = await supabaseAdmin
    .from("games")
    .select("id")
    .eq("status", "active")
    .or(`white_id.eq.${userId},black_id.eq.${userId}`);
  const ids = (data ?? []).map((g) => g.id);
  if (!ids.length) return 0;
  await supabaseAdmin
    .from("games")
    .update({
      status: "aborted",
      end_reason: reason,
      ended_at: new Date().toISOString(),
    })
    .in("id", ids);
  for (const id of ids) {
    await supabaseAdmin.from("game_events").insert({
      game_id: id,
      type: "admin_abort",
      payload: { reason } as never,
    });
  }
  return ids.length;
}

export async function fetchFlaggedGames(page: number, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const { data, count, error } = await supabaseAdmin
    .from("games")
    .select(
      "id, white_id, black_id, status, result, end_reason, time_control, variant, ply, flag_reason, created_at, ended_at",
      { count: "exact" },
    )
    .eq("flagged_for_review", true)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  const ids = new Set<string>();
  for (const g of data ?? []) {
    ids.add(g.white_id);
    ids.add(g.black_id);
  }
  const names = ids.size
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", [...ids])).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));

  return {
    games: (data ?? []).map((g) => ({
      ...g,
      whiteName: nameMap.get(g.white_id) ?? "—",
      blackName: nameMap.get(g.black_id) ?? "—",
    })),
    total: count ?? 0,
  };
}

export async function fetchGameDetail(gameId: string) {
  const { data: game, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!game) throw new Error("Game not found");

  const [moves, telemetry, analysis, players] = await Promise.all([
    supabaseAdmin
      .from("moves")
      .select("ply, san, uci, by_user, created_at")
      .eq("game_id", gameId)
      .order("ply"),
    supabaseAdmin
      .from("move_telemetry")
      .select("ply, user_id, elapsed_ms")
      .eq("game_id", gameId)
      .order("ply"),
    supabaseAdmin.from("game_analysis").select("*").eq("game_id", gameId).maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id, username, rating, flagged_for_review")
      .in("id", [game.white_id, game.black_id]),
  ]);

  return {
    game,
    moves: moves.data ?? [],
    telemetry: telemetry.data ?? [],
    analysis: analysis.data ?? null,
    players: players.data ?? [],
  };
}

export async function fetchPayments(opts: {
  page: number;
  pageSize: number;
  status?: string;
  userId?: string;
}) {
  let q = supabaseAdmin
    .from("payment_events")
    .select("id, user_id, event, reference, amount, currency, plan_code, created_at", {
      count: "exact",
    });
  if (opts.status && opts.status !== "all") q = q.eq("event", opts.status);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((p) => p.user_id).filter(Boolean))] as string[];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));

  return {
    payments: (data ?? []).map((p) => ({
      ...p,
      username: p.user_id ? nameMap.get(p.user_id) ?? "—" : "—",
    })),
    total: count ?? 0,
  };
}

export async function fetchRevenueBreakdown(days: number) {
  const since = daysAgo(days);
  const { data, error } = await supabaseAdmin
    .from("payment_events")
    .select("amount, plan_code, created_at")
    .eq("event", "charge.success")
    .gte("created_at", since)
    .order("created_at");
  if (error) throw new Error(error.message);

  const byDay = new Map<string, number>();
  const byPlan = new Map<string, number>();
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    const naira = (row.amount ?? 0) / 100;
    byDay.set(day, (byDay.get(day) ?? 0) + naira);
    const plan = row.plan_code ?? "unknown";
    byPlan.set(plan, (byPlan.get(plan) ?? 0) + naira);
  }

  const series: Array<{ day: string; naira: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day, naira: Math.round(byDay.get(day) ?? 0) });
  }

  return {
    series,
    byPlan: [...byPlan.entries()].map(([plan, naira]) => ({ plan, naira: Math.round(naira) })),
    total: Math.round([...byDay.values()].reduce((a, b) => a + b, 0)),
  };
}

export async function fetchCoaches(status: string) {
  let q = supabaseAdmin
    .from("coach_profiles")
    .select(
      "id, user_id, display_name, fide_title, fide_elo, hourly_rate_kobo, currency, specialties, languages, is_active, avg_rating, rating_count, sessions_completed, created_at",
    );
  if (status === "active") q = q.eq("is_active", true);
  if (status === "pending" || status === "inactive") q = q.eq("is_active", false);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { coaches: data ?? [] };
}

export async function fetchOrgs() {
  const [{ data: members }, { data: tournaments }] = await Promise.all([
    supabaseAdmin.from("org_members").select("org_owner_id, user_id, role, created_at"),
    supabaseAdmin
      .from("org_tournaments")
      .select("id, owner_id, name, format, status, rounds, current_round, starts_at, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const ownerIds = [...new Set((members ?? []).map((m) => m.org_owner_id))];
  for (const t of tournaments ?? []) if (!ownerIds.includes(t.owner_id)) ownerIds.push(t.owner_id);

  const names = ownerIds.length
    ? (await supabaseAdmin
        .from("profiles")
        .select("id, username, subscription_tier, is_org")
        .in("id", ownerIds)).data ?? []
    : [];

  return {
    orgs: names.map((o) => ({
      ...o,
      memberCount: (members ?? []).filter((m) => m.org_owner_id === o.id).length,
      tournaments: (tournaments ?? []).filter((t) => t.owner_id === o.id),
    })),
  };
}

export async function fetchReports(status: string, page: number, pageSize = 25) {
  let q = supabaseAdmin
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, details, status, resolution_note, resolved_at, created_at",
      { count: "exact" },
    );
  if (status !== "all") q = q.eq("status", status);
  const from = (page - 1) * pageSize;
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((r) => r.reporter_id))];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));

  return {
    reports: (data ?? []).map((r) => ({
      ...r,
      reporterName: nameMap.get(r.reporter_id) ?? "—",
    })),
    total: count ?? 0,
  };
}

export async function fetchAuditLog(opts: {
  page: number;
  pageSize: number;
  action?: string;
  adminId?: string;
  since?: string;
}) {
  let q = supabaseAdmin
    .from("admin_audit_log")
    .select("id, admin_id, action, target_table, target_id, before, after, reason, created_at", {
      count: "exact",
    });
  if (opts.action) q = q.ilike("action", `%${opts.action}%`);
  if (opts.adminId) q = q.eq("admin_id", opts.adminId);
  if (opts.since) q = q.gte("created_at", opts.since);
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await q
    .order("created_at", { ascending: false })
    .range(from, from + opts.pageSize - 1);
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((r) => r.admin_id))];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));

  return {
    entries: (data ?? []).map((r) => ({ ...r, adminName: nameMap.get(r.admin_id) ?? r.admin_id })),
    total: count ?? 0,
  };
}

export async function fetchAdminRoster() {
  const { data, error } = await supabaseAdmin
    .from("admin_roles")
    .select("id, user_id, role, granted_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).flatMap((r) => [r.user_id, r.granted_by].filter(Boolean)))] as string[];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));

  return {
    admins: (data ?? []).map((r) => ({
      ...r,
      username: nameMap.get(r.user_id) ?? r.user_id,
      grantedByName: r.granted_by ? nameMap.get(r.granted_by) ?? r.granted_by : null,
    })),
  };
}

export async function findProfileByUsername(username: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, username, subscription_tier")
    .ilike("username", username)
    .maybeSingle();
  return data;
}

export async function fetchAllApiKeys() {
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select(
      "id, owner_id, name, key_prefix, scopes, monthly_limit, revoked_at, last_used_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((k) => k.owner_id))];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));
  return { keys: (data ?? []).map((k) => ({ ...k, owner: nameMap.get(k.owner_id) ?? k.owner_id })) };
}

export async function fetchAllWebhooks() {
  const { data, error } = await supabaseAdmin
    .from("api_webhooks")
    .select("id, owner_id, url, events, failure_count, disabled, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((w) => w.owner_id))];
  const names = ids.length
    ? (await supabaseAdmin.from("profiles").select("id, username").in("id", ids)).data ?? []
    : [];
  const nameMap = new Map(names.map((n) => [n.id, n.username]));
  return {
    webhooks: (data ?? []).map((w) => ({ ...w, owner: nameMap.get(w.owner_id) ?? w.owner_id })),
  };
}
