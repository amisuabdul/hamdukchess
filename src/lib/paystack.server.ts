// Server-only Paystack helpers. NEVER import this from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PaidTier } from "@/lib/paystack-pricing";

export const PAYSTACK_BASE = "https://api.paystack.co";

export function getPaystackSecret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

/**
 * Apply tier upgrade. Sets subscription_tier, status=active, renewal +30 days.
 * Used by webhook + manual verify.
 */
export async function applySubscriptionUpgrade(args: {
  userId: string;
  tier: PaidTier;
  customerCode: string | null;
  reference: string;
  amount: number;
  currency: string;
}) {
  const renews = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_tier: args.tier,
      subscription_status: "active",
      subscription_renews_at: renews,
      paystack_customer_code: args.customerCode ?? undefined,
    })
    .eq("id", args.userId);

  await supabaseAdmin.from("payment_events").insert({
    user_id: args.userId,
    event: "subscription.activated",
    reference: args.reference,
    amount: args.amount,
    currency: args.currency,
    plan_code: args.tier,
    raw: { tier: args.tier, renews_at: renews },
  });
}
