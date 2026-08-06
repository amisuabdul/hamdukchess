import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are Hamduk Chess Coach, a warm, encouraging personal chess companion.

Rules:
- Explain in plain, everyday language, like a patient human coach. Prefer "your knight sat on the edge, where it controls only a few squares" over engine jargon.
- Reference concrete squares, pieces and plans. Never invent moves that are not in the position or game you were given.
- Keep answers focused: 2-5 short paragraphs or a tight bullet list. Use markdown.
- When the player's weakness report is provided, tie your advice to it and suggest one concrete next practice step (puzzles, endgames, openings).
- If you are unsure about a position, say so instead of guessing.`;

type ChatBody = { messages?: unknown; threadId?: unknown };

function textOf(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join(" ")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableApiKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !publishableKey) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!lovableApiKey) {
          return new Response("AI is not configured", { status: 500 });
        }

        const authClient = createClient<Database>(supabaseUrl, publishableKey, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
        const userId = claimsData?.claims?.sub;
        if (claimsError || !userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages) || typeof body.threadId !== "string") {
          return new Response("messages and threadId are required", { status: 400 });
        }
        const messages = body.messages as UIMessage[];
        const threadId = body.threadId;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("subscription_tier, username")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.subscription_tier !== "gold") {
          return new Response("The AI Assistant is a Gold feature. Upgrade to unlock it.", {
            status: 403,
          });
        }

        const { data: thread } = await supabaseAdmin
          .from("assistant_threads")
          .select("id, title, game_id")
          .eq("id", threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return new Response("Conversation not found", { status: 404 });

        // ---- Context injection: weakness report + optional linked game ----
        const contextChunks: string[] = [];
        const { data: report } = await supabaseAdmin
          .from("weakness_reports")
          .select("games_analyzed, piece_blunders, phase_errors, opening_gaps, suggestions, summary")
          .eq("user_id", userId)
          .maybeSingle();
        if (report) {
          contextChunks.push(
            `Player weakness report (last ${report.games_analyzed} games): ${JSON.stringify({
              piece_blunders: report.piece_blunders,
              phase_errors: report.phase_errors,
              opening_gaps: report.opening_gaps,
              suggestions: report.suggestions,
            }).slice(0, 2500)}`,
          );
        }
        if (thread.game_id) {
          const { data: game } = await supabaseAdmin
            .from("games")
            .select("pgn, fen, result, end_reason, white_id, black_id, time_control, variant")
            .eq("id", thread.game_id)
            .maybeSingle();
          if (game) {
            contextChunks.push(
              `Linked game — the player played as ${
                game.white_id === userId ? "White" : "Black"
              }, time control ${game.time_control}, variant ${game.variant}, result ${
                game.result ?? "unfinished"
              } (${game.end_reason ?? "-"}).\nPGN: ${(game.pgn ?? "").slice(0, 4000)}\nFinal FEN: ${game.fen}`,
            );
          }
        }
        if (profile?.username) contextChunks.push(`Player username: ${profile.username}`);

        const system =
          contextChunks.length > 0
            ? `${SYSTEM_PROMPT}\n\nContext about this player:\n${contextChunks.join("\n\n")}`
            : SYSTEM_PROMPT;

        // Persist the newest user message
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const { error: insertError } = await supabaseAdmin.from("assistant_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: last.parts as never,
            sdk_message_id: last.id ?? null,
          });
          if (insertError) console.error("[assistant] user message insert failed", insertError);

          const isFirst = messages.filter((m) => m.role === "user").length === 1;
          const title = textOf(last).slice(0, 60);
          const { error: threadError } = await supabaseAdmin
            .from("assistant_threads")
            .update({
              updated_at: new Date().toISOString(),
              ...(isFirst && title ? { title } : {}),
            })
            .eq("id", threadId)
            .eq("user_id", userId);
          if (threadError) console.error("[assistant] thread touch failed", threadError);
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(lovableApiKey, initialRunId);

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system,
          messages: convertToModelMessages(messages),
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
          onFinish: async ({ responseMessage }) => {
            const { error } = await supabaseAdmin.from("assistant_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as never,
              sdk_message_id: responseMessage.id ?? null,
            });
            if (error) console.error("[assistant] assistant message insert failed", error);
          },
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
