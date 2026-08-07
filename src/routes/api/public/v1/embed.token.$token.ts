import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

export const Route = createFileRoute("/api/public/v1/embed/token/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withApiKey(request, "/v1/embed/token/{token}", "board:embed", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("embed_tokens")
            .select("token, kind, config, expires_at, created_at")
            .eq("token", params.token)
            .eq("owner_id", ctx.ownerId)
            .maybeSingle();
          if (!data) return json({ error: "not_found" }, 404);
          const origin = new URL(request.url).origin;
          return json({
            ...data,
            expired: data.expires_at ? new Date(data.expires_at) < new Date() : false,
            embed_url: `${origin}/embed/${data.kind}/${data.token}`,
          });
        }),
      DELETE: async ({ request, params }) =>
        withApiKey(request, "/v1/embed/token/{token}", "board:embed", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("embed_tokens")
            .delete()
            .eq("token", params.token)
            .eq("owner_id", ctx.ownerId);
          if (error) return json({ error: "server_error", message: error.message }, 500);
          return json({ ok: true });
        }),
    },
  },
});
