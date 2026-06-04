import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TimeControl = z.enum(["3+0", "5+0", "10+0", "15+10"]);
const Variant = z.enum(["standard", "chess960"]);

export const getMyRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ratings")
      .select("time_control, variant, rating, games_played, wins, losses, draws, bot_games, updated_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ratings: data ?? [] };
  });

export const getUserRatings = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ratings")
      .select("time_control, variant, rating, games_played, wins, losses, draws, bot_games")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ratings: rows ?? [] };
  });

export const recordBotGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    timeControl: TimeControl,
    variant: Variant.default("standard"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("record_bot_game", {
      p_time_control: data.timeControl,
      p_variant: data.variant,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
