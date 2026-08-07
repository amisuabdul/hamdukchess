import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { API_SCOPES, WEBHOOK_EVENTS } from "@/lib/api-scopes";

const ScopeArray = z.array(z.enum(API_SCOPES)).min(1);

async function assertApiAccess(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_tier, is_org")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  if (data.subscription_tier !== "gold" && !data.is_org) {
    throw new Error("The developer API is available on Gold and organisation accounts.");
  }
  return data;
}

export const getApiAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("subscription_tier, is_org")
      .eq("id", context.userId)
      .single();
    const tier = (data?.subscription_tier ?? "free") as string;
    return { tier, isOrg: Boolean(data?.is_org), allowed: tier === "gold" || Boolean(data?.is_org) };
  });

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertApiAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: keys, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, scopes, monthly_limit, revoked_at, last_used_at, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { data: usage } = await supabaseAdmin
      .from("api_usage")
      .select("key_id, endpoint, status")
      .eq("owner_id", context.userId)
      .gte("created_at", monthStart.toISOString())
      .limit(5000);

    const byKey: Record<string, number> = {};
    const byEndpoint: Record<string, number> = {};
    let errors = 0;
    for (const row of usage ?? []) {
      byKey[row.key_id] = (byKey[row.key_id] ?? 0) + 1;
      byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] ?? 0) + 1;
      if (row.status >= 400) errors += 1;
    }

    return {
      keys: (keys ?? []).map((k) => ({ ...k, callsThisMonth: byKey[k.id] ?? 0 })),
      usage: {
        total: (usage ?? []).length,
        errors,
        byEndpoint: Object.entries(byEndpoint)
          .map(([endpoint, calls]) => ({ endpoint, calls }))
          .sort((a, b) => b.calls - a.calls),
      },
    };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1).max(60),
        scopes: ScopeArray,
        monthlyLimit: z.number().int().min(100).max(1_000_000).default(10_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertApiAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey } = await import("@/lib/api-keys.server");

    const { prefix, plaintext, hash } = generateApiKey();
    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        owner_id: context.userId,
        name: data.name,
        key_prefix: prefix,
        key_hash: hash,
        scopes: data.scopes,
        monthly_limit: data.monthlyLimit,
      })
      .select("id, name, key_prefix, scopes, monthly_limit, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: row, plaintext };
  });

export const updateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        scopes: ScopeArray.optional(),
        monthlyLimit: z.number().int().min(100).max(1_000_000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.scopes) patch.scopes = data.scopes;
    if (data.monthlyLimit) patch.monthly_limit = data.monthlyLimit;
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update(patch as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rotate: revoke the old key immediately and issue a replacement with the same config. */
export const regenerateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey } = await import("@/lib/api-keys.server");

    const { data: old, error: oldErr } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, scopes, monthly_limit")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    if (oldErr || !old) throw new Error("Key not found");

    const { prefix, plaintext, hash } = generateApiKey();
    const { error: insErr } = await supabaseAdmin.from("api_keys").insert({
      owner_id: context.userId,
      name: old.name,
      key_prefix: prefix,
      key_hash: hash,
      scopes: old.scopes,
      monthly_limit: old.monthly_limit,
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", old.id);

    return { plaintext, prefix };
  });

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hooks, error } = await supabaseAdmin
      .from("api_webhooks")
      .select("id, url, events, failure_count, disabled, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (hooks ?? []).map((h) => h.id);
    let deliveries: Array<{
      id: string;
      webhook_id: string;
      event: string;
      status: string;
      response_status: number | null;
      error: string | null;
      created_at: string;
    }> = [];
    if (ids.length) {
      const { data } = await supabaseAdmin
        .from("webhook_deliveries")
        .select("id, webhook_id, event, status, response_status, error, created_at")
        .in("webhook_id", ids)
        .order("created_at", { ascending: false })
        .limit(30);
      deliveries = data ?? [];
    }
    return { webhooks: hooks ?? [], deliveries };
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url().max(500),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertApiAccess(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateToken } = await import("@/lib/api-keys.server");
    const secret = generateToken(24);
    const { data: row, error } = await supabaseAdmin
      .from("api_webhooks")
      .insert({ owner_id: context.userId, url: data.url, events: data.events, secret })
      .select("id, url, events, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { webhook: row, secret };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_webhooks")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sendTestDelivery } = await import("@/lib/webhooks.server");
    const result = await sendTestDelivery(data.id, context.userId);
    return result;
  });

export const setWebhookEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_webhooks")
      .update({ disabled: !data.enabled, failure_count: 0 })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
