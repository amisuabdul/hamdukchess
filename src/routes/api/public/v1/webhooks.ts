import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json, generateToken } from "@/lib/api-keys.server";
import { WEBHOOK_EVENTS } from "@/lib/api-scopes";

const Schema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export const Route = createFileRoute("/api/public/v1/webhooks")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiKey(request, "/v1/webhooks", "webhooks", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("api_webhooks")
            .select("id, url, events, failure_count, disabled, created_at")
            .eq("owner_id", ctx.ownerId)
            .order("created_at", { ascending: false });
          return json({ webhooks: data ?? [] });
        }),
      POST: async ({ request }) =>
        withApiKey(request, "/v1/webhooks", "webhooks", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad_request", message: "Invalid JSON body" }, 400);
          }
          const parsed = Schema.safeParse(body);
          if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);

          const secret = generateToken(24);
          const { data, error } = await supabaseAdmin
            .from("api_webhooks")
            .insert({
              owner_id: ctx.ownerId,
              key_id: ctx.keyId,
              url: parsed.data.url,
              events: parsed.data.events,
              secret,
            })
            .select("id, url, events, created_at")
            .single();
          if (error) return json({ error: "server_error", message: error.message }, 500);

          // The signing secret is only ever returned once, at creation time.
          return json({ webhook: data, signing_secret: secret }, 201);
        }),
    },
  },
});
