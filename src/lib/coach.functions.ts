import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const FenSchema = z.object({
  fen: z.string().min(10).max(100),
});

// Tightened from 50k → 8k chars (~ a full 200-move PGN with annotations is well under this).
const PgnSchema = z.object({
  pgn: z.string().min(1).max(8_000),
});

type AiResult = { markdown: string; error?: undefined } | { markdown?: undefined; error: string };

async function callGateway(systemPrompt: string, userContent: string): Promise<AiResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { error: "AI is not configured on this project." };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (res.status === 429) return { error: "Rate limited — please try again in a moment." };
  if (res.status === 402) return { error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." };
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, text);
    return { error: `AI request failed (${res.status}).` };
  }

  const data = await res.json();
  const markdown: string | undefined = data?.choices?.[0]?.message?.content;
  if (!markdown) return { error: "AI returned an empty response." };
  return { markdown };
}

export const explainPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FenSchema.parse(input))
  .handler(async ({ data }) => {
    return callGateway(
      "You are a sharp, encouraging chess coach. Given a FEN, return a concise plain-language assessment of the position. Cover: material balance, immediate threats for both sides, strategic plans, and 2–3 candidate moves with one-line justifications. Use Markdown with short sections. Stay under 220 words. Do not invent moves that are not legal — when uncertain, hedge.",
      `Analyze this position (FEN): ${data.fen}`,
    );
  });

export const recapGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PgnSchema.parse(input))
  .handler(async ({ data }) => {
    return callGateway(
      "You are a chess commentator. Given a PGN, produce a 4–6 sentence narrative recap of the game. Mention the opening by name if recognizable, call out the key turning point(s) with move numbers, and explain why the game ended as it did. Use Markdown. Be vivid but accurate.",
      `Recap this game (PGN):\n\n${data.pgn}`,
    );
  });
