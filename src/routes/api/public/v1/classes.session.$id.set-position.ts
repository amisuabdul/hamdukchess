import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json, broadcastRealtime } from "@/lib/api-keys.server";

const Schema = z.object({
  position_fen: z.string().min(10).max(120),
  locked: z.boolean().optional(),
  snap_students: z.boolean().default(true),
});

export const Route = createFileRoute("/api/public/v1/classes/session/$id/set-position")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        withApiKey(request, "/v1/classes/session/{id}/set-position", "classes:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad_request", message: "Invalid JSON body" }, 400);
          }
          const parsed = Schema.safeParse(body);
          if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);

          const { data: session } = await supabaseAdmin
            .from("class_sessions")
            .select("id")
            .eq("id", params.id)
            .eq("owner_id", ctx.ownerId)
            .maybeSingle();
          if (!session) return json({ error: "not_found" }, 404);

          const patch: { position_fen: string; locked?: boolean } = { position_fen: parsed.data.position_fen };
          if (parsed.data.locked !== undefined) patch.locked = parsed.data.locked;
          await supabaseAdmin.from("class_sessions").update(patch).eq("id", session.id);

          if (parsed.data.snap_students) {
            await supabaseAdmin
              .from("class_session_students")
              .update({ board_fen: parsed.data.position_fen, moves_made: 0 })
              .eq("session_id", session.id);
          }

          await broadcastRealtime(`class:${session.id}`, "set_position", {
            position_fen: parsed.data.position_fen,
            locked: parsed.data.locked ?? null,
          });

          return json({ session_id: session.id, position_fen: parsed.data.position_fen, locked: parsed.data.locked ?? null });
        }),
    },
  },
});
