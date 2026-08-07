import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json, broadcastRealtime } from "@/lib/api-keys.server";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const CreateSchema = z.object({
  title: z.string().min(1).max(120).default("Class session"),
  position_fen: z.string().min(10).max(120).default(START_FEN),
  locked: z.boolean().default(false),
  students: z
    .array(z.object({ username: z.string().min(1).max(64).optional(), label: z.string().min(1).max(80) }))
    .max(100)
    .default([]),
});

export const Route = createFileRoute("/api/public/v1/classes/session")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiKey(request, "/v1/classes/session", "classes:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("class_sessions")
            .select("id, title, position_fen, locked, status, created_at")
            .eq("owner_id", ctx.ownerId)
            .order("created_at", { ascending: false })
            .limit(50);
          return json({ sessions: data ?? [] });
        }),
      POST: async ({ request }) =>
        withApiKey(request, "/v1/classes/session", "classes:manage", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");

          let body: unknown = {};
          try {
            body = await request.json();
          } catch {
            body = {};
          }
          const parsed = CreateSchema.safeParse(body);
          if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);

          const { data: session, error } = await supabaseAdmin
            .from("class_sessions")
            .insert({
              owner_id: ctx.ownerId,
              key_id: ctx.keyId,
              title: parsed.data.title,
              position_fen: parsed.data.position_fen,
              locked: parsed.data.locked,
            })
            .select("id, title, position_fen, locked, status, created_at")
            .single();
          if (error || !session) return json({ error: "server_error", message: error?.message }, 500);

          if (parsed.data.students.length) {
            const usernames = parsed.data.students.map((s) => s.username).filter(Boolean) as string[];
            const { data: found } = usernames.length
              ? await supabaseAdmin.from("profiles").select("id, username").in("username", usernames)
              : { data: [] as Array<{ id: string; username: string }> };
            const byName = new Map((found ?? []).map((p) => [p.username, p.id]));
            await supabaseAdmin.from("class_session_students").insert(
              parsed.data.students.map((s) => ({
                session_id: session.id,
                user_id: s.username ? (byName.get(s.username) ?? null) : null,
                label: s.label,
                board_fen: parsed.data.position_fen,
              })),
            );
          }

          await dispatchWebhookEvent(ctx.ownerId, "class.session_started", {
            session_id: session.id,
            position_fen: session.position_fen,
          });
          await broadcastRealtime(`class:${session.id}`, "session_started", {
            position_fen: session.position_fen,
            locked: session.locked,
          });

          const origin = new URL(request.url).origin;
          return json(
            {
              session_id: session.id,
              session,
              realtime_channel: `class:${session.id}`,
              instructor_url: `${origin}/classes/${session.id}`,
            },
            201,
          );
        }),
    },
  },
});
