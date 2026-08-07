// Server-only webhook fan-out with signed payloads, retry backoff (1s, 5s, 25s)
// and auto-disable after 5 consecutive failures.
import { createHmac } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { WebhookEvent } from "@/lib/api-scopes";

const BACKOFF_SEC = [1, 5, 25];
const MAX_FAILURES = 5;

export function signPayload(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

type WebhookRow = {
  id: string;
  owner_id: string;
  url: string;
  secret: string;
  events: string[];
  failure_count: number;
};

async function attemptDelivery(
  hook: Pick<WebhookRow, "id" | "url" | "secret">,
  event: string,
  payload: unknown,
) {
  const body = JSON.stringify({ event, data: payload, sent_at: new Date().toISOString() });
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hamduk-event": event,
        "x-hamduk-signature": signPayload(hook.secret, body),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: null as number | null, error: (err as Error).message };
  }
}

async function recordSuccess(hook: { id: string }, deliveryId: string, status: number | null) {
  await supabaseAdmin
    .from("webhook_deliveries")
    .update({ status: "delivered", response_status: status, delivered_at: new Date().toISOString(), next_retry_at: null })
    .eq("id", deliveryId);
  await supabaseAdmin.from("api_webhooks").update({ failure_count: 0 }).eq("id", hook.id);
}

async function recordFailure(
  hook: { id: string; failure_count: number; owner_id?: string },
  deliveryId: string,
  attempt: number,
  status: number | null,
  error: string | null,
) {
  const exhausted = attempt >= BACKOFF_SEC.length;
  await supabaseAdmin
    .from("webhook_deliveries")
    .update({
      status: exhausted ? "failed" : "pending",
      attempt,
      response_status: status,
      error,
      next_retry_at: exhausted
        ? null
        : new Date(Date.now() + BACKOFF_SEC[attempt] * 1000).toISOString(),
    })
    .eq("id", deliveryId);

  if (!exhausted) return;

  const failures = (hook.failure_count ?? 0) + 1;
  const disabled = failures >= MAX_FAILURES;
  await supabaseAdmin
    .from("api_webhooks")
    .update({ failure_count: failures, disabled })
    .eq("id", hook.id);

  if (disabled) {
    console.error(`[webhooks] disabled ${hook.id} after ${failures} consecutive failures`);
    await supabaseAdmin.from("activity_feed").insert({
      user_id: hook.owner_id!,
      type: "webhook.disabled",
      payload: { webhook_id: hook.id, failures },
    });
  }
}

/** Fan an event out to every enabled webhook of an org owner. */
export async function dispatchWebhookEvent(
  ownerId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const { data: hooks } = await supabaseAdmin
    .from("api_webhooks")
    .select("id, owner_id, url, secret, events, failure_count")
    .eq("owner_id", ownerId)
    .eq("disabled", false);

  for (const hook of (hooks ?? []) as WebhookRow[]) {
    if (!hook.events.includes(event)) continue;
    const { data: delivery } = await supabaseAdmin
      .from("webhook_deliveries")
      .insert({ webhook_id: hook.id, event, payload, attempt: 1, status: "pending" })
      .select("id")
      .single();
    if (!delivery) continue;
    const result = await attemptDelivery(hook, event, payload);
    if (result.ok) await recordSuccess(hook, delivery.id, result.status);
    else await recordFailure(hook, delivery.id, 1, result.status, result.error);
  }
}

/** Emit an event to every org that has the given member linked. */
export async function dispatchForMember(
  userId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const { data: memberships } = await supabaseAdmin
    .from("org_members")
    .select("org_owner_id")
    .eq("user_id", userId);
  const owners = new Set<string>((memberships ?? []).map((m) => m.org_owner_id));
  for (const owner of owners) await dispatchWebhookEvent(owner, event, payload);
}

/** Retry deliveries whose backoff window has elapsed. Called by the sweep route. */
export async function retryDueDeliveries(limit = 25) {
  const { data: due } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, attempt")
    .eq("status", "pending")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  for (const d of due ?? []) {
    const { data: hook } = await supabaseAdmin
      .from("api_webhooks")
      .select("id, owner_id, url, secret, failure_count, disabled")
      .eq("id", d.webhook_id)
      .maybeSingle();
    if (!hook || hook.disabled) continue;
    const attempt = (d.attempt ?? 1) + 1;
    const result = await attemptDelivery(hook, d.event, d.payload);
    if (result.ok) await recordSuccess(hook, d.id, result.status);
    else await recordFailure(hook, d.id, attempt, result.status, result.error);
    processed += 1;
  }
  return processed;
}

/** One-off test delivery used by the dashboard "Test" button. */
export async function sendTestDelivery(webhookId: string, ownerId: string) {
  const { data: hook } = await supabaseAdmin
    .from("api_webhooks")
    .select("id, owner_id, url, secret, failure_count")
    .eq("id", webhookId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!hook) throw new Error("Webhook not found");
  const result = await attemptDelivery(hook, "webhook.test", { ok: true, at: Date.now() });
  await supabaseAdmin.from("webhook_deliveries").insert({
    webhook_id: hook.id,
    event: "webhook.test",
    payload: { ok: true },
    attempt: 1,
    status: result.ok ? "delivered" : "failed",
    response_status: result.status,
    error: result.error,
    delivered_at: result.ok ? new Date().toISOString() : null,
  });
  return result;
}
