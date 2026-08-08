import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecordSchema = z.object({
  eco: z.string().min(1).max(8),
  correct: z.number().int().min(0).max(200),
  attempts: z.number().int().min(0).max(200),
  masteredDepth: z.number().int().min(0).max(200),
});

const RepertoireAddSchema = z.object({
  eco: z.string().min(1).max(8),
  color: z.enum(["white", "black"]),
  notes: z.string().max(2000).optional(),
});

const RepertoireIdSchema = z.object({ id: z.string().uuid() });

export type OpeningProgress = {
  eco: string;
  attempts: number;
  correct: number;
  mastered_depth: number;
  last_practiced_at: string | null;
};

/** Authed — user's full opening progress map. */
export const getMyOpeningProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_opening_progress")
      .select("eco,attempts,correct,mastered_depth,last_practiced_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as OpeningProgress[];
  });

/** Authed — upsert a training session result for one opening. */
export const recordOpeningSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RecordSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Load existing so we can accumulate + take max depth.
    const { data: existing } = await supabase
      .from("user_opening_progress")
      .select("attempts,correct,mastered_depth")
      .eq("user_id", userId)
      .eq("eco", data.eco)
      .maybeSingle();

    const nextAttempts = (existing?.attempts ?? 0) + data.attempts;
    const nextCorrect = (existing?.correct ?? 0) + data.correct;
    const nextDepth = Math.max(existing?.mastered_depth ?? 0, data.masteredDepth);

    const { error } = await supabase
      .from("user_opening_progress")
      .upsert(
        {
          user_id: userId,
          eco: data.eco,
          attempts: nextAttempts,
          correct: nextCorrect,
          mastered_depth: nextDepth,
          last_practiced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,eco" },
      );
    if (error) throw new Error(error.message);
    return {
      attempts: nextAttempts,
      correct: nextCorrect,
      mastered_depth: nextDepth,
    };
  });

// ---- Repertoire (Gold-gated) ----

async function requireGold(_supabase: unknown, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (profile?.subscription_tier !== "gold") {
    throw new Error("Personal repertoire requires a Gold subscription.");
  }
}

export const getMyRepertoire = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_repertoire")
      .select("id,eco,color,notes,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addToRepertoire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RepertoireAddSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireGold(supabase, userId);
    const { error } = await supabase.from("user_repertoire").upsert(
      {
        user_id: userId,
        eco: data.eco,
        color: data.color,
        notes: data.notes ?? null,
      },
      { onConflict: "user_id,eco,color" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFromRepertoire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RepertoireIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_repertoire")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
