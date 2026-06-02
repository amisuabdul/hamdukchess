import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { redis } from "./redis.server";

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await redis.set(`presence:${context.userId}`, "online", { ex: 30 });
    return { ok: true };
  });

export const onlineCount = createServerFn({ method: "GET" })
  .handler(async () => {
    const cached = await redis.get<string>("presence:count");
    if (cached) return { count: Number(cached) };
    // Scan up to 1000 presence keys
    let cursor = 0;
    let total = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: "presence:*", count: 200 });
      total += keys.filter((k) => k !== "presence:count").length;
      cursor = Number(next);
      if (total > 1000) break;
    } while (cursor !== 0);
    await redis.set("presence:count", String(total), { ex: 60 });
    return { count: total };
  });

export const markDisconnected = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await redis.set(`game:${data.gameId}:disconnect:${userId}`, Date.now(), { ex: 30 });
    await supabaseAdmin.from("game_events").insert({
      game_id: data.gameId,
      type: "disconnect",
      by_user: userId,
      payload: { at: new Date().toISOString() },
    });
    return { ok: true };
  });

export const reconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await redis.del(`game:${data.gameId}:disconnect:${userId}`);
    await supabaseAdmin.from("game_events").insert({
      game_id: data.gameId,
      type: "reconnect",
      by_user: userId,
      payload: {},
    });
    return { ok: true };
  });

export const claimDisconnectWin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, status, ply, white_id, black_id")
      .eq("id", data.gameId)
      .single();
    if (error || !game) throw new Error("Game not found");
    if (game.status !== "active") return { ended: false };
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");
    const opponentId = userId === game.white_id ? game.black_id : game.white_id;

    // Opponent must still be marked disconnected
    const disc = await redis.get(`game:${data.gameId}:disconnect:${opponentId}`);
    if (!disc) return { ended: false, reason: "opponent_reconnected" };

    if (game.ply < 10) {
      // Abort, no rating change
      await supabaseAdmin.from("games").update({
        status: "completed",
        result: "draw",
        end_reason: "abort",
        ended_at: new Date().toISOString(),
      }).eq("id", game.id);
      await supabaseAdmin.from("game_events").insert({
        game_id: game.id, type: "abort", by_user: userId, payload: { reason: "disconnect_pre_move_10" },
      });
      return { ended: true, reason: "aborted" };
    }

    // Award win to claimer
    const isWhite = userId === game.white_id;
    const result = isWhite ? "white" : "black";
    await supabaseAdmin.from("games").update({
      status: "completed",
      result,
      winner_id: userId,
      end_reason: "disconnect",
      ended_at: new Date().toISOString(),
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "disconnect_win", by_user: userId, payload: {},
    });
    await supabaseAdmin.rpc("apply_elo", {
      p_white: game.white_id,
      p_black: game.black_id,
      p_result: result,
    });
    return { ended: true, reason: "disconnect_win" };
  });
