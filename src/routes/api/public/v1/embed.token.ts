import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { withApiKey, json, generateToken } from "@/lib/api-keys.server";
import { EMBED_KINDS } from "@/lib/api-scopes";

const TokenSchema = z.object({
  kind: z.enum(EMBED_KINDS),
  config: z
    .object({
      theme: z.enum(["light", "dark", "auto"]).default("auto"),
      orientation: z.enum(["white", "black"]).default("white"),
      fen: z.string().max(120).optional(),
      game_id: z.string().uuid().optional(),
      puzzle_id: z.string().uuid().optional(),
      interactive: z.boolean().default(true),
      show_controls: z.boolean().default(true),
      size: z.number().int().min(200).max(900).optional(),
      responsive: z.boolean().default(true),
      session_id: z.string().uuid().optional(),
    })
    .default({}),
  ttl_hours: z.number().int().min(1).max(24 * 365).default(720),
});

export const Route = createFileRoute("/api/public/v1/embed/token")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withApiKey(request, "/v1/embed/token", "board:embed", async (ctx) => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "bad_request", message: "Invalid JSON body" }, 400);
          }
          const parsed = TokenSchema.safeParse(body);
          if (!parsed.success) return json({ error: "bad_request", message: parsed.error.issues[0]?.message }, 400);

          const token = generateToken(20);
          const expires = new Date(Date.now() + parsed.data.ttl_hours * 3600_000).toISOString();
          const { error } = await supabaseAdmin.from("embed_tokens").insert({
            token,
            key_id: ctx.keyId,
            owner_id: ctx.ownerId,
            kind: parsed.data.kind,
            config: parsed.data.config,
            expires_at: expires,
          });
          if (error) return json({ error: "server_error", message: error.message }, 500);

          const origin = new URL(request.url).origin;
          return json(
            {
              token,
              kind: parsed.data.kind,
              expires_at: expires,
              embed_url: `${origin}/embed/${parsed.data.kind}/${token}`,
              iframe: `<iframe src="${origin}/embed/${parsed.data.kind}/${token}" style="width:100%;aspect-ratio:1/1;border:0" loading="lazy"></iframe>`,
            },
            201,
          );
        }),
    },
  },
});
