import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SaveInput = z.object({
  tutorial_id: z.string().min(1).max(64),
  step_index: z.number().int().min(0).max(500),
  completed: z.boolean().optional(),
});

export const getMyTutorialProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_tutorial_progress")
      .select("tutorial_id, step_index, completed, completed_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveTutorialProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const completedAt = data.completed ? new Date().toISOString() : null;
    const { error } = await context.supabase
      .from("user_tutorial_progress")
      .upsert(
        {
          user_id: context.userId,
          tutorial_id: data.tutorial_id,
          step_index: data.step_index,
          completed: data.completed ?? false,
          completed_at: completedAt,
        },
        { onConflict: "user_id,tutorial_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
