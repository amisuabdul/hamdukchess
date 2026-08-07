import { createFileRoute } from "@tanstack/react-router";
import { withApiKey, json } from "@/lib/api-keys.server";

export const Route = createFileRoute("/api/public/v1/classes/session/$id/students")({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        withApiKey(request, "/v1/classes/session/{id}/students", "classes:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: session } = await supabaseAdmin
            .from("class_sessions")
            .select("id, title, position_fen, locked, status")
            .eq("id", params.id)
            .eq("owner_id", ctx.ownerId)
            .maybeSingle();
          if (!session) return json({ error: "not_found" }, 404);

          const { data: students } = await supabaseAdmin
            .from("class_session_students")
            .select("id, user_id, label, board_fen, moves_made, last_seen_at")
            .eq("session_id", session.id)
            .order("label", { ascending: true });

          return json({ session, students: students ?? [] });
        }),
    },
  },
});
