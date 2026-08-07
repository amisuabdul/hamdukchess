import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json, resolveOrgUser } from "@/lib/api-keys.server";

export const Route = createFileRoute("/api/public/v1/users/$username/rating")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withApiKey(request, "/v1/users/{username}/rating", "ratings:read", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const profile = await resolveOrgUser(ctx.ownerId, params.username);
          if (!profile) return json({ error: "not_found", message: "No org-linked user with that username" }, 404);

          const { data: ratings } = await supabaseAdmin
            .from("ratings")
            .select("time_control, variant, rating, games_played, wins, losses, draws")
            .eq("user_id", profile.id);

          return json({
            username: profile.username,
            classical_rating: profile.rating,
            country: profile.country,
            ratings: ratings ?? [],
          });
        }),
      OPTIONS: async ({ request }) =>
        withApiKey(request, "/v1/users/{username}/rating", "ratings:read", async () => json({})),
    },
  },
});
