import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecordSchema = z.object({
  endgameId: z.string().min(1).max(64),
  completed: z.boolean(),
  moveCount: z.number().int().min(0).max(500),
});

export type EndgameProgress = {
  endgame_id: string;
  attempts: number;
  completed: boolean;
  best_move_count: number | null;
  last_practiced_at: string | null;
};

export const getMyEndgameProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_endgame_progress")
      .select("endgame_id,attempts,completed,best_move_count,last_practiced_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as EndgameProgress[];
  });

export const recordEndgameAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RecordSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("user_endgame_progress")
      .select("attempts,completed,best_move_count")
      .eq("user_id", userId)
      .eq("endgame_id", data.endgameId)
      .maybeSingle();

    const nextAttempts = (existing?.attempts ?? 0) + 1;
    const nextCompleted = Boolean(existing?.completed) || data.completed;
    const nextBest = data.completed
      ? existing?.best_move_count == null
        ? data.moveCount
        : Math.min(existing.best_move_count, data.moveCount)
      : existing?.best_move_count ?? null;

    const { error } = await supabase.from("user_endgame_progress").upsert(
      {
        user_id: userId,
        endgame_id: data.endgameId,
        attempts: nextAttempts,
        completed: nextCompleted,
        best_move_count: nextBest,
        last_practiced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endgame_id" },
    );
    if (error) throw new Error(error.message);
    return {
      attempts: nextAttempts,
      completed: nextCompleted,
      best_move_count: nextBest,
    };
  });
