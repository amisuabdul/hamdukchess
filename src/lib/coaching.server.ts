// Server-only coaching helpers. NEVER import from client code.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PAYSTACK_BASE, getPaystackSecret } from "@/lib/paystack.server";

/** Publishable-key server client for public reads (RLS as anon). */
export function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Initialize a Paystack checkout for a coaching session, splitting to the coach subaccount when set. */
export async function initSessionCheckout(args: {
  email: string;
  amountKobo: number;
  platformFeeKobo: number;
  reference: string;
  callbackUrl: string;
  subaccountCode: string | null;
  metadata: Record<string, unknown>;
}) {
  const body: Record<string, unknown> = {
    email: args.email,
    amount: args.amountKobo,
    currency: "NGN",
    reference: args.reference,
    callback_url: args.callbackUrl,
    metadata: args.metadata,
  };
  if (args.subaccountCode) {
    body.subaccount = args.subaccountCode;
    body.transaction_charge = args.platformFeeKobo;
    body.bearer = "account";
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    status: boolean;
    message?: string;
    data?: { authorization_url: string; reference: string };
  };
  if (!res.ok || !json.status || !json.data) {
    throw new Error(json.message || "Paystack initialize failed");
  }
  return json.data;
}

export async function verifyPaystackReference(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getPaystackSecret()}` },
  });
  const json = (await res.json()) as {
    status: boolean;
    data?: { status: string; reference: string; amount: number; currency: string; metadata?: Record<string, unknown> };
  };
  if (!res.ok || !json.status || !json.data) return null;
  return json.data;
}
