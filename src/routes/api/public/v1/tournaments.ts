import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json } from "@/lib/api-keys.server";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  format: z.enum(["swiss", "arena", "round_robin"]).default("swiss"),
  time_control: z.string().min(2).max(10).default("5+0"),
  rounds: z.number().int().min(1).max(20).default(5),
  starts_at: z.string().datetime().optional(),
  players: z
    .array(z.object({ username: z.string().min(1).max(64).optional(), display_name: z.string().min(1).max(80) }))
    .max(200)
    .default([]),
});

export const Route = createFileRoute("/api/public/v1/tournaments")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiKey(request, "/v1/tournaments", "tournaments:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("org_tournaments")
            .select("id, name, format, time_control, rounds, current_round, status, starts_at, created_at")
            .eq("owner_id", ctx.ownerId)
            .order("created_at", { ascending: false })
            .limit(100);
          return json({ tournaments: data ?? [] });
        }),
      POST: async ({ request }) =>
        withApiKey(request, "/v1/tournaments", "tournaments:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad_request", message: "Invalid JSON body" }, 400);
          }
          const parsed = CreateSchema.safeParse(body);
          if (!parsed.success) {
            return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);
          }
          const input = parsed.data;

          const { data: tournament, error } = await supabaseAdmin
            .from("org_tournaments")
            .insert({
              owner_id: ctx.ownerId,
              name: input.name,
              format: input.format,
              time_control: input.time_control,
              rounds: input.rounds,
              starts_at: input.starts_at ?? null,
              status: "scheduled",
            })
            .select("id, name, format, time_control, rounds, current_round, status, starts_at")
            .single();
          if (error || !tournament) return json({ error: "server_error", message: error?.message }, 500);

          if (input.players.length) {
            const usernames = input.players.map((p) => p.username).filter(Boolean) as string[];
            const { data: found } = usernames.length
              ? await supabaseAdmin.from("profiles").select("id, username").in("username", usernames)
              : { data: [] as Array<{ id: string; username: string }> };
            const byName = new Map((found ?? []).map((p) => [p.username, p.id]));
            await supabaseAdmin.from("org_tournament_players").insert(
              input.players.map((p) => ({
                tournament_id: tournament.id,
                user_id: p.username ? (byName.get(p.username) ?? null) : null,
                display_name: p.display_name,
              })),
            );
          }

          return json({ tournament }, 201);
        }),
    },
  },
});
