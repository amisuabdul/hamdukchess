import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRate } from "./rate-limit.server";
import { chess960StartFen } from "./chess960";

const GameIdInput = z.object({ gameId: z.string().uuid() });
const OFFER_TTL_MS = 30_000;

async function loadGame(gameId: string) {
  const { data, error } = await supabaseAdmin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();
  if (error || !data) throw new Error("Game not found");
  return data;
}

function assertParticipant(game: { white_id: string; black_id: string }, userId: string) {
  if (userId !== game.white_id && userId !== game.black_id) {
    throw new Error("Not a participant");
  }
}

export const offerDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (game.status !== "active") throw new Error("Game is not active");
    await supabaseAdmin.from("games").update({
      draw_offer_by: userId,
      draw_offer_at: new Date().toISOString(),
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "draw_offer", by_user: userId, payload: {},
    });
    return { ok: true };
  });

export const respondDraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.extend({ accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (game.status !== "active") throw new Error("Game is not active");
    if (!game.draw_offer_by || game.draw_offer_by === userId) throw new Error("No pending offer");
    const offered = game.draw_offer_at ? new Date(game.draw_offer_at).getTime() : 0;
    if (Date.now() - offered > OFFER_TTL_MS) {
      await supabaseAdmin.from("games").update({ draw_offer_by: null, draw_offer_at: null }).eq("id", game.id);
      throw new Error("Offer expired");
    }
    if (data.accept) {
      await supabaseAdmin.from("games").update({
        status: "completed",
        result: "draw",
        end_reason: "agreement",
        ended_at: new Date().toISOString(),
        draw_offer_by: null,
        draw_offer_at: null,
      }).eq("id", game.id);
      await supabaseAdmin.from("game_events").insert({
        game_id: game.id, type: "draw_accept", by_user: userId, payload: {},
      });
      await supabaseAdmin.rpc("apply_elo", {
        p_white: game.white_id, p_black: game.black_id, p_result: "draw",
      });
      {
        const { emitGameCompleted } = await import("@/lib/game-webhooks.server");
        await emitGameCompleted(game.id);
      }
    } else {
      await supabaseAdmin.from("games").update({
        draw_offer_by: null, draw_offer_at: null,
      }).eq("id", game.id);
      await supabaseAdmin.from("game_events").insert({
        game_id: game.id, type: "draw_decline", by_user: userId, payload: {},
      });
    }
    return { ok: true };
  });

export const abortGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (game.status !== "active") throw new Error("Game is not active");
    if (game.ply >= 6) throw new Error("Too late to abort");
    await supabaseAdmin.from("games").update({
      status: "completed",
      result: "draw",
      end_reason: "abort",
      ended_at: new Date().toISOString(),
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "abort", by_user: userId, payload: {},
    });
    {
      const { emitGameCompleted } = await import("@/lib/game-webhooks.server");
      await emitGameCompleted(game.id);
    }
    return { ok: true };
  });

export const requestTakeback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (game.status !== "active") throw new Error("Game is not active");
    if (game.rated) throw new Error("Takebacks not allowed in rated games");
    if (game.ply === 0) throw new Error("No move to take back");
    await supabaseAdmin.from("games").update({
      takeback_offer_by: userId,
      takeback_offer_at: new Date().toISOString(),
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "takeback_offer", by_user: userId, payload: {},
    });
    return { ok: true };
  });

export const respondTakeback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.extend({ accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (!game.takeback_offer_by || game.takeback_offer_by === userId) throw new Error("No pending takeback");
    const offered = game.takeback_offer_at ? new Date(game.takeback_offer_at).getTime() : 0;
    if (Date.now() - offered > OFFER_TTL_MS) {
      await supabaseAdmin.from("games").update({ takeback_offer_by: null, takeback_offer_at: null }).eq("id", game.id);
      throw new Error("Offer expired");
    }
    if (!data.accept) {
      await supabaseAdmin.from("games").update({
        takeback_offer_by: null, takeback_offer_at: null,
      }).eq("id", game.id);
      await supabaseAdmin.from("game_events").insert({
        game_id: game.id, type: "takeback_decline", by_user: userId, payload: {},
      });
      return { ok: true };
    }
    // Pop last move, restore fen from prior move (or start)
    const { data: lastMoves } = await supabaseAdmin
      .from("moves")
      .select("id, ply, fen")
      .eq("game_id", game.id)
      .order("ply", { ascending: false })
      .limit(2);
    const last = lastMoves?.[0];
    const prev = lastMoves?.[1];
    if (!last) throw new Error("No move to take back");
    const newFen = prev?.fen ?? (game.chess960_start_fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    await supabaseAdmin.from("moves").delete().eq("id", last.id);
    await supabaseAdmin.from("games").update({
      fen: newFen,
      ply: game.ply - 1,
      takeback_offer_by: null,
      takeback_offer_at: null,
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "takeback_accept", by_user: userId, payload: { reverted_ply: last.ply },
    });
    return { ok: true };
  });

export const offerRematch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertRate(userId, "rematch", 20, 60 * 60 * 24);
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    if (game.status !== "completed") throw new Error("Game still in progress");
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "rematch_offer", by_user: userId, payload: {},
    });
    return { ok: true };
  });

export const acceptRematch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const game = await loadGame(data.gameId);
    assertParticipant(game, userId);
    // Verify a pending rematch offer exists from opponent
    const { data: events } = await supabaseAdmin
      .from("game_events")
      .select("*")
      .eq("game_id", game.id)
      .eq("type", "rematch_offer")
      .order("id", { ascending: false })
      .limit(1);
    const offer = events?.[0];
    if (!offer || offer.by_user === userId) throw new Error("No pending rematch");

    // Swap colors
    const newWhite = game.black_id;
    const newBlack = game.white_id;
    const startFen = game.variant === "chess960" ? chess960StartFen() : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const { data: created, error } = await supabaseAdmin
      .from("games")
      .insert({
        white_id: newWhite,
        black_id: newBlack,
        time_control: game.time_control,
        variant: game.variant,
        chess960_start_fen: game.variant === "chess960" ? startFen : null,
        initial_sec: game.initial_sec,
        increment_sec: game.increment_sec,
        time_white_ms: (game.initial_sec ?? 300) * 1000,
        time_black_ms: (game.initial_sec ?? 300) * 1000,
        last_clock_update: new Date().toISOString(),
        fen: startFen,
        rated: game.rated,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed to create rematch");
    return { gameId: created.id };
  });

export const checkFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GameIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const game = await loadGame(data.gameId);
    assertParticipant(game, context.userId);
    if (game.status !== "active") return { flagged: false };
    if (!game.last_clock_update || !game.initial_sec) return { flagged: false };
    const elapsed = Date.now() - new Date(game.last_clock_update).getTime();
    // Determine whose clock is running: from current fen turn
    const turn = game.fen.split(" ")[1] as "w" | "b";
    const remaining = turn === "w" ? (game.time_white_ms ?? 0) - elapsed : (game.time_black_ms ?? 0) - elapsed;
    if (remaining > 0 || game.ply < 2) return { flagged: false };
    const result = turn === "w" ? "black" : "white";
    const winnerId = turn === "w" ? game.black_id : game.white_id;
    await supabaseAdmin.from("games").update({
      status: "completed",
      result,
      winner_id: winnerId,
      end_reason: "flag",
      time_white_ms: turn === "w" ? 0 : game.time_white_ms,
      time_black_ms: turn === "b" ? 0 : game.time_black_ms,
      ended_at: new Date().toISOString(),
    }).eq("id", game.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: game.id, type: "flag", by_user: null, payload: { loser: turn },
    });
    await supabaseAdmin.rpc("apply_elo", {
      p_white: game.white_id, p_black: game.black_id, p_result: result,
    });
    {
      const { emitGameCompleted } = await import("@/lib/game-webhooks.server");
      await emitGameCompleted(game.id);
    }
    return { flagged: true };
  });
