import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json, resolveOrgUser } from "@/lib/api-keys.server";

const TC_MAP: Record<string, string[]> = {
  bullet: ["1+0", "2+1"],
  blitz: ["3+0", "5+0"],
  rapid: ["10+0", "15+10"],
};

export const Route = createFileRoute("/api/public/v1/users/$username/games")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withApiKey(request, "/v1/users/{username}/games", "games:read", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const profile = await resolveOrgUser(ctx.ownerId, params.username);
          if (!profile) return json({ error: "not_found", message: "No org-linked user with that username" }, 404);

          const url = new URL(request.url);
          const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
          const tc = url.searchParams.get("tc");

          let query = supabaseAdmin
            .from("games")
            .select(
              "id, white_id, black_id, time_control, variant, status, result, end_reason, pgn, ply, rated, created_at, ended_at, white_rating_delta, black_rating_delta",
            )
            .or(`white_id.eq.${profile.id},black_id.eq.${profile.id}`)
            .order("created_at", { ascending: false })
            .limit(limit);

          if (tc) {
            const controls = TC_MAP[tc] ?? [tc];
            query = query.in("time_control", controls);
          }

          const { data: games, error } = await query;
          if (error) return json({ error: "server_error", message: error.message }, 500);

          const ids = new Set<string>();
          for (const g of games ?? []) {
            ids.add(g.white_id);
            ids.add(g.black_id);
          }
          const { data: people } = await supabaseAdmin
            .from("profiles")
            .select("id, username")
            .in("id", Array.from(ids));
          const names = new Map((people ?? []).map((p) => [p.id, p.username]));

          return json({
            username: profile.username,
            count: (games ?? []).length,
            games: (games ?? []).map((g) => ({
              game_id: g.id,
              white: names.get(g.white_id) ?? null,
              black: names.get(g.black_id) ?? null,
              time_control: g.time_control,
              variant: g.variant,
              status: g.status,
              result: g.result,
              end_reason: g.end_reason,
              rated: g.rated,
              moves: g.ply,
              pgn: g.pgn,
              white_rating_delta: g.white_rating_delta,
              black_rating_delta: g.black_rating_delta,
              created_at: g.created_at,
              ended_at: g.ended_at,
            })),
          });
        }),
    },
  },
});
