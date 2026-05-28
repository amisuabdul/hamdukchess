import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TimeControl = z.enum(["3+0", "5+0", "10+0", "15+10"]);

export const findOrJoinMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ timeControl: TimeControl }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: gameId, error } = await supabase.rpc("find_or_join_match", {
      p_time_control: data.timeControl,
      p_rating_window: 200,
    });
    if (error) throw new Error(error.message);
    return { gameId: gameId as string | null };
  });

export const cancelQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("matchmaking_queue").delete().eq("user_id", userId);
    return { ok: true };
  });

export const submitMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      gameId: z.string().uuid(),
      uci: z.string().min(4).max(5).regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Read + write game state with service-role client. Direct UPDATE on games
    // is no longer allowed via RLS — all mutations must go through here.
    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, fen, pgn, ply, status")
      .eq("id", data.gameId)
      .single();
    if (gErr || !game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");

    const chess = new Chess(game.fen);
    if (game.pgn) {
      try { chess.loadPgn(game.pgn); } catch { /* fallback to fen */ }
    }
    const expectedColor = chess.turn(); // 'w' | 'b'
    const isWhite = userId === game.white_id;
    if ((expectedColor === "w" && !isWhite) || (expectedColor === "b" && isWhite)) {
      throw new Error("Not your turn");
    }
    const from = data.uci.slice(0, 2);
    const to = data.uci.slice(2, 4);
    const promotion = data.uci[4] as "q" | "r" | "b" | "n" | undefined;
    let move;
    try {
      move = chess.move({ from, to, promotion: promotion ?? "q" });
    } catch {
      throw new Error("Illegal move");
    }
    if (!move) throw new Error("Illegal move");

    const newFen = chess.fen();
    const newPgn = chess.pgn();
    const newPly = game.ply + 1;

    let status: string = "active";
    let result: string | null = null;
    let winnerId: string | null = null;
    let endReason: string | null = null;
    if (chess.isCheckmate()) {
      status = "completed";
      result = expectedColor === "w" ? "white" : "black";
      winnerId = result === "white" ? game.white_id : game.black_id;
      endReason = "checkmate";
    } else if (chess.isStalemate()) {
      status = "completed";
      result = "draw";
      endReason = "stalemate";
    } else if (chess.isDraw()) {
      status = "completed";
      result = "draw";
      endReason = "draw";
    }

    const baseUpdate = {
      fen: newFen,
      pgn: newPgn,
      ply: newPly,
      last_move_at: new Date().toISOString(),
      status,
    };
    const update = status === "completed"
      ? {
          ...baseUpdate,
          result,
          winner_id: winnerId,
          end_reason: endReason,
          ended_at: new Date().toISOString(),
        }
      : baseUpdate;

    const { error: uErr } = await supabaseAdmin.from("games").update(update).eq("id", game.id);
    if (uErr) throw new Error(uErr.message);

    const { error: mErr } = await supabaseAdmin.from("moves").insert({
      game_id: game.id,
      ply: newPly,
      uci: data.uci,
      san: move.san,
      fen: newFen,
      by_user: userId,
    });
    if (mErr) throw new Error(mErr.message);

    if (status === "completed" && result) {
      await supabaseAdmin.rpc("apply_elo", {
        p_white: game.white_id,
        p_black: game.black_id,
        p_result: result,
      });
    }

    return { ok: true, san: move.san, fen: newFen, status, result };
  });

export const resignGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, status")
      .eq("id", data.gameId)
      .single();
    if (error || !game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game already ended");
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");

    const isWhite = userId === game.white_id;
    const result = isWhite ? "black" : "white";
    const winnerId = isWhite ? game.black_id : game.white_id;

    const { error: uErr } = await supabaseAdmin
      .from("games")
      .update({
        status: "completed",
        result,
        winner_id: winnerId,
        end_reason: "resignation",
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.gameId);
    if (uErr) throw new Error(uErr.message);

    await supabaseAdmin.rpc("apply_elo", {
      p_white: game.white_id,
      p_black: game.black_id,
      p_result: result,
    });
    return { ok: true };
  });
