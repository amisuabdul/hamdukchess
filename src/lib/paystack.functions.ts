import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TIER_PRICING, type PaidTier } from "@/lib/paystack-pricing";
import {
  PAYSTACK_BASE,
  applySubscriptionUpgrade,
  getPaystackSecret,
} from "@/lib/paystack.server";

export const initializePaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tier: z.enum(["plus", "gold"]),
        callback_url: z.string().url().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { tier, callback_url } = data;
    const pricing = TIER_PRICING[tier];

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .single();
    if (profileErr || !profile) throw new Error("Profile not found");

    const { data: userRes } = await supabase.auth.getUser();
    const email =
      userRes.user?.email ?? `${profile.username}+guest@hamdukchess.local`;

    const reference = `hc_${tier}_${userId.slice(0, 8)}_${Date.now()}`;

    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: pricing.amount_kobo,
        currency: "NGN",
        reference,
        callback_url,
        metadata: {
          user_id: userId,
          username: profile.username,
          tier,
          custom_fields: [
            { display_name: "Tier", variable_name: "tier", value: pricing.label },
            { display_name: "Username", variable_name: "username", value: profile.username },
          ],
        },
      }),
    });

    const json = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; access_code: string; reference: string };
    };
    if (!res.ok || !json.status || !json.data) {
      throw new Error(json.message || "Paystack initialize failed");
    }

    await supabaseAdmin.from("payment_events").insert({
      user_id: userId,
      event: "checkout.initialized",
      reference: json.data.reference,
      amount: pricing.amount_kobo,
      currency: "NGN",
      plan_code: tier,
      raw: json.data,
    });

    return {
      authorization_url: json.data.authorization_url,
      reference: json.data.reference,
    };
  });

export const verifyPaystackTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reference: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${getPaystackSecret()}` } },
    );
    const json = (await res.json()) as {
      status: boolean;
      data?: {
        status: string;
        reference: string;
        amount: number;
        currency: string;
        customer?: { customer_code?: string; email?: string };
        metadata?: { user_id?: string; tier?: PaidTier };
      };
    };
    if (!res.ok || !json.status || !json.data) {
      return { ok: false as const, status: "failed" };
    }
    const tx = json.data;
    const tier = (tx.metadata?.tier ?? null) as PaidTier | null;
    const txUser = tx.metadata?.user_id;

    if (tx.status === "success" && tier && txUser === userId) {
      await applySubscriptionUpgrade({
        userId,
        tier,
        customerCode: tx.customer?.customer_code ?? null,
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
      });
      return { ok: true as const, status: tx.status, tier };
    }
    return { ok: false as const, status: tx.status };
  });
