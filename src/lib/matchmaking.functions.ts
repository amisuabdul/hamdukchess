import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chess960StartFen } from "./chess960";

const TimeControl = z.enum(["3+0", "5+0", "10+0", "15+10"]);
const Variant = z.enum(["standard", "chess960"]);

export const findOrJoinMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    timeControl: TimeControl,
    variant: Variant.default("standard"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const startFen = data.variant === "chess960" ? chess960StartFen() : null;
    const { data: gameId, error } = await supabase.rpc("find_or_join_match", {
      p_time_control: data.timeControl,
      p_rating_window: 200,
      p_variant: data.variant,
      p_start_fen: startFen ?? undefined,
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
      elapsedMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: game, error: gErr } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, fen, pgn, ply, status, time_white_ms, time_black_ms, increment_sec, last_clock_update, initial_sec, chess960_start_fen, variant")
      .eq("id", data.gameId)
      .single();
    if (gErr || !game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");

    const startFen = game.chess960_start_fen ?? undefined;
    const chess = new Chess(startFen);
    if (game.pgn) {
      try { chess.loadPgn(game.pgn); } catch { chess.load(game.fen); }
    } else {
      chess.load(game.fen);
    }
    const expectedColor = chess.turn();
    const isWhite = userId === game.white_id;
    if ((expectedColor === "w" && !isWhite) || (expectedColor === "b" && isWhite)) {
      throw new Error("Not your turn");
    }

    // Server-authoritative clock update
    const now = Date.now();
    const lastUpdate = game.last_clock_update ? new Date(game.last_clock_update).getTime() : now;
    const elapsedServer = Math.max(0, now - lastUpdate);
    const incMs = (game.increment_sec ?? 0) * 1000;

    let newWhiteMs = game.time_white_ms ?? (game.initial_sec ?? 300) * 1000;
    let newBlackMs = game.time_black_ms ?? (game.initial_sec ?? 300) * 1000;
    const flagged = expectedColor === "w"
      ? newWhiteMs - elapsedServer <= 0 && game.ply >= 2
      : newBlackMs - elapsedServer <= 0 && game.ply >= 2;

    if (flagged) {
      // Mover ran out of time
      const result = expectedColor === "w" ? "black" : "white";
      const winnerId = result === "white" ? game.white_id : game.black_id;
      await supabaseAdmin.from("games").update({
        status: "completed",
        result,
        winner_id: winnerId,
        end_reason: "flag",
        time_white_ms: expectedColor === "w" ? 0 : newWhiteMs,
        time_black_ms: expectedColor === "b" ? 0 : newBlackMs,
        ended_at: new Date().toISOString(),
      }).eq("id", game.id);
      await supabaseAdmin.from("game_events").insert({
        game_id: game.id, type: "flag", by_user: null, payload: { loser: expectedColor },
      });
      await supabaseAdmin.rpc("apply_elo", {
        p_white: game.white_id, p_black: game.black_id, p_result: result,
      });
      throw new Error("Flagged on time");
    }

    if (expectedColor === "w") newWhiteMs = Math.max(0, newWhiteMs - elapsedServer) + incMs;
    else newBlackMs = Math.max(0, newBlackMs - elapsedServer) + incMs;

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
      last_clock_update: new Date().toISOString(),
      time_white_ms: newWhiteMs,
      time_black_ms: newBlackMs,
      status,
      // Any pending offer is canceled when a move is made
      draw_offer_by: null,
      draw_offer_at: null,
      takeback_offer_by: null,
      takeback_offer_at: null,
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

    // Telemetry (server-authoritative timing)
    await supabaseAdmin.from("move_telemetry").insert({
      game_id: game.id,
      ply: newPly,
      user_id: userId,
      elapsed_ms: elapsedServer,
    });

    // Event log
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id,
      type: "move",
      by_user: userId,
      payload: { uci: data.uci, san: move.san, ply: newPly, elapsed_ms: elapsedServer },
    });

    if (status === "completed" && result) {
      await supabaseAdmin.rpc("apply_elo", {
        p_white: game.white_id,
        p_black: game.black_id,
        p_result: result,
      });
      // Naive anti-cheat flag: avg move time < 3s across ≥ 20 moves
      const { data: tele } = await supabaseAdmin
        .from("move_telemetry")
        .select("elapsed_ms")
        .eq("game_id", game.id)
        .eq("user_id", userId);
      if (tele && tele.length >= 20) {
        const avg = tele.reduce((a, b) => a + b.elapsed_ms, 0) / tele.length;
        if (avg < 3000) {
          await supabaseAdmin
            .from("profiles")
            .update({ flagged_for_review: true, flag_reason: "fast_moves" })
            .eq("id", userId);
        }
      }
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

    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "resign", by_user: userId, payload: {},
    });

    await supabaseAdmin.rpc("apply_elo", {
      p_white: game.white_id,
      p_black: game.black_id,
      p_result: result,
    });
    return { ok: true };
  });
