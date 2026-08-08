// Server-only emitters that fan game-finish and rating changes out to org webhooks.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchForMember } from "@/lib/webhooks.server";

/**
 * Emit `game.completed` (and `rating.changed` for each player whose rating moved)
 * to every org that has either player linked as a member.
 * Safe to call fire-and-forget: it never throws.
 */
export async function emitGameCompleted(gameId: string) {
  try {
    const { data: game } = await supabaseAdmin
      .from("games")
      .select(
        "id, white_id, black_id, result, end_reason, status, pgn, fen, ply, time_control, variant, rated, region, is_bot_game, ended_at, winner_id, white_rating_delta, black_rating_delta",
      )
      .eq("id", gameId)
      .maybeSingle();
    if (!game || game.status !== "completed") return;

    const { data: players } = await supabaseAdmin
      .from("profiles")
      .select("id, username, rating")
      .in("id", [game.white_id, game.black_id]);
    const byId = new Map((players ?? []).map((p) => [p.id, p]));

    const payload = {
      game_id: game.id,
      status: game.status,
      result: game.result,
      end_reason: game.end_reason,
      winner_id: game.winner_id,
      time_control: game.time_control,
      variant: game.variant,
      rated: game.rated,
      region: game.region,
      is_bot_game: game.is_bot_game,
      ply: game.ply,
      fen: game.fen,
      pgn: game.pgn,
      ended_at: game.ended_at,
      white: {
        user_id: game.white_id,
        username: byId.get(game.white_id)?.username ?? null,
        rating_delta: game.white_rating_delta,
      },
      black: {
        user_id: game.black_id,
        username: byId.get(game.black_id)?.username ?? null,
        rating_delta: game.black_rating_delta,
      },
    };

    const participants = Array.from(new Set([game.white_id, game.black_id]));
    for (const userId of participants) {
      await dispatchForMember(userId, "game.completed", payload);
    }

    if (!game.rated) return;

    const { data: ratings } = await supabaseAdmin
      .from("ratings")
      .select("user_id, rating, games_played")
      .in("user_id", participants)
      .eq("time_control", game.time_control)
      .eq("variant", game.variant);

    for (const userId of participants) {
      const delta = userId === game.white_id ? game.white_rating_delta : game.black_rating_delta;
      if (delta === null || delta === undefined) continue;
      const row = (ratings ?? []).find((r) => r.user_id === userId);
      await dispatchForMember(userId, "rating.changed", {
        user_id: userId,
        username: byId.get(userId)?.username ?? null,
        game_id: game.id,
        time_control: game.time_control,
        variant: game.variant,
        delta,
        rating: row?.rating ?? byId.get(userId)?.rating ?? null,
        previous_rating: row?.rating != null ? row.rating - delta : null,
        games_played: row?.games_played ?? null,
      });
    }
  } catch (err) {
    console.error("[game-webhooks] emitGameCompleted failed", (err as Error).message);
  }
}
