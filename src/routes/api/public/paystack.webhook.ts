import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applySubscriptionUpgrade } from "@/lib/paystack.server";
import type { PaidTier } from "@/lib/paystack-pricing";

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha512", secret).update(body).digest("hex");

        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");
        if (
          sigBuf.length !== expBuf.length ||
          !timingSafeEqual(sigBuf, expBuf)
        ) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: {
          event: string;
          data: {
            reference?: string;
            status?: string;
            amount?: number;
            currency?: string;
            customer?: { customer_code?: string; email?: string };
            metadata?: { user_id?: string; tier?: PaidTier };
            subscription_code?: string;
            next_payment_date?: string;
          };
        };
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        // Log every event for audit
        await supabaseAdmin.from("payment_events").insert({
          user_id: payload.data?.metadata?.user_id ?? null,
          event: payload.event,
          reference: payload.data?.reference ?? null,
          amount: payload.data?.amount ?? null,
          currency: payload.data?.currency ?? null,
          plan_code: payload.data?.metadata?.tier ?? null,
          raw: payload,
        });

        const tier = payload.data?.metadata?.tier as PaidTier | undefined;
        const userId = payload.data?.metadata?.user_id;

        if (
          payload.event === "charge.success" &&
          payload.data.status === "success" &&
          tier &&
          userId
        ) {
          await applySubscriptionUpgrade({
            userId,
            tier,
            customerCode: payload.data.customer?.customer_code ?? null,
            reference: payload.data.reference ?? "",
            amount: payload.data.amount ?? 0,
            currency: payload.data.currency ?? "NGN",
          });
        }

        if (
          payload.event === "subscription.disable" ||
          payload.event === "subscription.not_renew" ||
          payload.event === "invoice.payment_failed"
        ) {
          if (userId) {
            await supabaseAdmin
              .from("profiles")
              .update({ subscription_status: "inactive" })
              .eq("id", userId);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
