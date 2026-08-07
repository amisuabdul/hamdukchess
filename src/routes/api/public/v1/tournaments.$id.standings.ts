import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json } from "@/lib/api-keys.server";

const RoundSchema = z.object({
  round: z.number().int().min(1).max(20),
  results: z
    .array(z.object({ player_id: z.string().uuid(), score: z.number(), tiebreak: z.number().optional() }))
    .default([]),
});

export const Route = createFileRoute("/api/public/v1/tournaments/$id/standings")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withApiKey(request, "/v1/tournaments/{id}/standings", "tournaments:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: tournament } = await supabaseAdmin
            .from("org_tournaments")
            .select("id, name, rounds, current_round, status")
            .eq("id", params.id)
            .eq("owner_id", ctx.ownerId)
            .maybeSingle();
          if (!tournament) return json({ error: "not_found" }, 404);

          const { data: players } = await supabaseAdmin
            .from("org_tournament_players")
            .select("id, user_id, display_name, score, tiebreak")
            .eq("tournament_id", tournament.id)
            .order("score", { ascending: false })
            .order("tiebreak", { ascending: false });

          return json({
            tournament,
            standings: (players ?? []).map((p, i) => ({ rank: i + 1, ...p })),
          });
        }),

      /** Post round results — advances the round and fires tournament.round_complete. */
      POST: async ({ request, params }) =>
        withApiKey(request, "/v1/tournaments/{id}/standings", "tournaments:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad_request", message: "Invalid JSON body" }, 400);
          }
          const parsed = RoundSchema.safeParse(body);
          if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);

          const { data: tournament } = await supabaseAdmin
            .from("org_tournaments")
            .select("id, name, rounds")
            .eq("id", params.id)
            .eq("owner_id", ctx.ownerId)
            .maybeSingle();
          if (!tournament) return json({ error: "not_found" }, 404);

          for (const r of parsed.data.results) {
            await supabaseAdmin
              .from("org_tournament_players")
              .update({ score: r.score, tiebreak: r.tiebreak ?? 0 })
              .eq("id", r.player_id)
              .eq("tournament_id", tournament.id);
          }

          const finished = parsed.data.round >= tournament.rounds;
          await supabaseAdmin
            .from("org_tournaments")
            .update({ current_round: parsed.data.round, status: finished ? "completed" : "live" })
            .eq("id", tournament.id);

          const { data: players } = await supabaseAdmin
            .from("org_tournament_players")
            .select("id, display_name, score, tiebreak")
            .eq("tournament_id", tournament.id)
            .order("score", { ascending: false });

          const standings = (players ?? []).map((p, i) => ({ rank: i + 1, ...p }));
          await dispatchWebhookEvent(ctx.ownerId, "tournament.round_complete", {
            tournament_id: tournament.id,
            round: parsed.data.round,
            standings,
          });

          return json({ tournament_id: tournament.id, round: parsed.data.round, standings });
        }),
    },
  },
});
