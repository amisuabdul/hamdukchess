// Server-only helpers for the B2B API: key issuing, bcrypt verification,
// scope checks, Redis rate limiting and usage logging.
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { redis } from "@/lib/redis.server";
import type { ApiScope } from "@/lib/api-scopes";

const KEY_PREFIX = "hck";
const BURST_PER_MINUTE = 120;

function randomHex(bytes: number) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey() {
  const prefix = `${KEY_PREFIX}_${randomHex(5)}`;
  const secret = randomHex(24);
  const plaintext = `${prefix}.${secret}`;
  const hash = bcrypt.hashSync(secret, 10);
  return { prefix, plaintext, hash };
}

export function generateToken(bytes = 20) {
  return randomHex(bytes);
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

export type ApiKeyContext = {
  keyId: string;
  ownerId: string;
  scopes: string[];
  monthlyLimit: number;
};

function monthStamp(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monthly quota + per-minute burst protection, both in Redis. */
async function checkQuota(ctx: ApiKeyContext) {
  const monthKey = `apiq:${ctx.keyId}:${monthStamp()}`;
  const burstKey = `apib:${ctx.keyId}:${Math.floor(Date.now() / 60_000)}`;

  const burst = await redis.incr(burstKey);
  if (burst === 1) await redis.expire(burstKey, 70);
  if (burst > BURST_PER_MINUTE) {
    return { ok: false as const, reason: "Burst limit exceeded (120 requests/minute)", used: 0 };
  }

  const used = await redis.incr(monthKey);
  if (used === 1) await redis.expire(monthKey, 60 * 60 * 24 * 35);
  if (used > ctx.monthlyLimit) {
    return { ok: false as const, reason: "Monthly call limit exceeded", used };
  }
  return { ok: true as const, used };
}

async function logUsage(ctx: ApiKeyContext, endpoint: string, method: string, status: number) {
  await supabaseAdmin.from("api_usage").insert({
    key_id: ctx.keyId,
    owner_id: ctx.ownerId,
    endpoint,
    method,
    status,
  });
}

/** Verify `Authorization: Bearer hck_xxxx.secret`. */
export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  const sep = raw.lastIndexOf(".");
  if (sep <= 0) return null;
  const prefix = raw.slice(0, sep);
  const secret = raw.slice(sep + 1);

  const { data: key } = await supabaseAdmin
    .from("api_keys")
    .select("id, owner_id, scopes, monthly_limit, key_hash, revoked_at")
    .eq("key_prefix", prefix)
    .maybeSingle();

  if (!key || key.revoked_at) return null;
  if (!bcrypt.compareSync(secret, key.key_hash)) return null;

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return {
    keyId: key.id,
    ownerId: key.owner_id,
    scopes: key.scopes ?? [],
    monthlyLimit: key.monthly_limit,
  };
}

/**
 * Wrap an API v1 handler: authenticate, enforce scope, rate limit, log usage.
 */
export async function withApiKey(
  request: Request,
  endpoint: string,
  scope: ApiScope,
  handler: (ctx: ApiKeyContext) => Promise<Response>,
): Promise<Response> {
  const method = request.method;
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      },
    });
  }

  let ctx: ApiKeyContext | null;
  try {
    ctx = await authenticateApiKey(request);
  } catch (err) {
    console.error("[api] auth error", err);
    return json({ error: "server_error" }, 500);
  }
  if (!ctx) return json({ error: "unauthorized", message: "Invalid or revoked API key" }, 401);

  if (!ctx.scopes.includes(scope)) {
    await logUsage(ctx, endpoint, method, 403);
    return json({ error: "forbidden", message: `Missing required scope: ${scope}` }, 403);
  }

  const quota = await checkQuota(ctx);
  if (!quota.ok) {
    await logUsage(ctx, endpoint, method, 429);
    return json({ error: "rate_limited", message: quota.reason }, 429, {
      "x-ratelimit-limit": String(ctx.monthlyLimit),
    });
  }

  let response: Response;
  try {
    response = await handler(ctx);
  } catch (err) {
    console.error(`[api] ${endpoint} failed`, err);
    response = json({ error: "server_error" }, 500);
  }

  await logUsage(ctx, endpoint, method, response.status);
  const headers = new Headers(response.headers);
  headers.set("x-ratelimit-limit", String(ctx.monthlyLimit));
  headers.set("x-ratelimit-remaining", String(Math.max(0, ctx.monthlyLimit - quota.used)));
  return new Response(response.body, { status: response.status, headers });
}

/** Profile ids linked to this org owner (org_members + the owner itself). */
export async function orgMemberIds(ownerId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("org_members")
    .select("user_id")
    .eq("org_owner_id", ownerId);
  return [ownerId, ...(data ?? []).map((r) => r.user_id)];
}

/** Resolve a username, but only if that account is linked to the org. */
export async function resolveOrgUser(ownerId: string, username: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, username, rating, country")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return null;
  const ids = await orgMemberIds(ownerId);
  if (!ids.includes(profile.id)) return null;
  return profile;
}

/** Broadcast on a Supabase Realtime channel from the server (REST API). */
export async function broadcastRealtime(channel: string, event: string, payload: unknown) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Realtime broadcast not configured");
  const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ messages: [{ topic: channel, event, payload }] }),
  });
  if (!res.ok) console.error("[realtime] broadcast failed", res.status, await res.text());
}
