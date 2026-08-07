import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

export const Route = createFileRoute("/api/public/v1/webhooks/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) =>
        withApiKey(request, "/v1/webhooks/{id}", "webhooks", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("api_webhooks")
            .delete()
            .eq("id", params.id)
            .eq("owner_id", ctx.ownerId);
          if (error) return json({ error: "server_error", message: error.message }, 500);
          return json({ ok: true });
        }),
    },
  },
});
