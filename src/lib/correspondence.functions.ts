import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Chess } from "chess.js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRate } from "./rate-limit.server";
import { chess960StartFen } from "./chess960";

const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DAYS = z.union([z.literal(1), z.literal(3), z.literal(7)]);
const FREE_ACTIVE_LIMIT = 3;
const MAX_VACATION_DAYS = 14;

function deadlineFrom(days: number, from = Date.now()) {
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString();
}

export const createCorrespondenceGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        opponentUsername: z.string().min(1).max(64),
        daysPerMove: DAYS,
        variant: z.enum(["standard", "chess960"]).default("standard"),
        color: z.enum(["random", "white", "black"]).default("random"),
        notifyByEmail: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertRate(userId, "corr-create", 20, 60 * 60 * 24);

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("id, subscription_tier")
      .eq("id", userId)
      .single();
    const tier = me?.subscription_tier ?? "free";

    if (tier === "free") {
      const { count } = await supabaseAdmin
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("is_correspondence", true)
        .or(`white_id.eq.${userId},black_id.eq.${userId}`);
      if ((count ?? 0) >= FREE_ACTIVE_LIMIT) {
        throw new Error(
          `Free accounts can have ${FREE_ACTIVE_LIMIT} active correspondence games. Upgrade for unlimited.`,
        );
      }
    }

    const { data: opp } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .ilike("username", data.opponentUsername)
      .maybeSingle();
    if (!opp) throw new Error("No player with that username");
    if (opp.id === userId) throw new Error("You cannot challenge yourself");

    const startFen = data.variant === "chess960" ? chess960StartFen() : STANDARD_FEN;
    const meWhite =
      data.color === "white" ? true : data.color === "black" ? false : Math.random() < 0.5;

    const { data: created, error } = await supabaseAdmin
      .from("games")
      .insert({
        white_id: meWhite ? userId : opp.id,
        black_id: meWhite ? opp.id : userId,
        time_control: `${data.daysPerMove}d`,
        variant: data.variant,
        chess960_start_fen: data.variant === "chess960" ? startFen : null,
        fen: startFen,
        rated: true,
        is_correspondence: true,
        days_per_move: data.daysPerMove,
        move_deadline: deadlineFrom(data.daysPerMove),
        notify_by_email: data.notifyByEmail,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create game");
    return { gameId: created.id, opponent: opp.username };
  });

export const listCorrespondenceGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: games, error } = await supabaseAdmin
      .from("games")
      .select(
        "id, white_id, black_id, fen, status, result, end_reason, time_control, variant, days_per_move, move_deadline, notify_by_email, created_at, ply",
      )
      .eq("is_correspondence", true)
      .or(`white_id.eq.${userId},black_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((games ?? []).flatMap((g) => [g.white_id, g.black_id])),
    ).filter((id) => id !== userId);
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      for (const p of profs ?? []) names[p.id] = p.username;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("vacation_until, vacation_days_used, vacation_year, subscription_tier")
      .eq("id", userId)
      .single();

    const year = new Date().getUTCFullYear();
    return {
      vacation: {
        until: profile?.vacation_until ?? null,
        daysUsed: profile?.vacation_year === year ? (profile?.vacation_days_used ?? 0) : 0,
        maxDays: MAX_VACATION_DAYS,
      },
      tier: profile?.subscription_tier ?? "free",
      games: (games ?? []).map((g) => {
        const isWhite = g.white_id === userId;
        let turn: "w" | "b" = "w";
        try {
          turn = new Chess(g.fen).turn();
        } catch {
          turn = (g.fen.split(" ")[1] as "w" | "b") ?? "w";
        }
        return {
          id: g.id,
          opponent: names[isWhite ? g.black_id : g.white_id] ?? "—",
          color: isWhite ? "white" : "black",
          status: g.status,
          result: g.result,
          endReason: g.end_reason,
          variant: g.variant,
          daysPerMove: g.days_per_move,
          moveDeadline: g.move_deadline,
          notifyByEmail: g.notify_by_email,
          myTurn: g.status === "active" && ((turn === "w") === isWhite),
          ply: g.ply,
        };
      }),
    };
  });

export const setVacationMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().min(0).max(MAX_VACATION_DAYS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const year = new Date().getUTCFullYear();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("vacation_days_used, vacation_year")
      .eq("id", userId)
      .single();
    const used = profile?.vacation_year === year ? (profile?.vacation_days_used ?? 0) : 0;

    if (data.days === 0) {
      await supabaseAdmin.from("profiles").update({ vacation_until: null }).eq("id", userId);
      return { until: null, daysUsed: used };
    }
    if (used + data.days > MAX_VACATION_DAYS) {
      throw new Error(`Only ${MAX_VACATION_DAYS - used} vacation day(s) left this year`);
    }
    const until = deadlineFrom(data.days);
    await supabaseAdmin
      .from("profiles")
      .update({ vacation_until: until, vacation_days_used: used + data.days, vacation_year: year })
      .eq("id", userId);
    return { until, daysUsed: used + data.days };
  });

export const setGameEmailNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ gameId: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id")
      .eq("id", data.gameId)
      .single();
    if (!game) throw new Error("Game not found");
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");
    await supabaseAdmin
      .from("games")
      .update({ notify_by_email: data.enabled })
      .eq("id", data.gameId);
    return { ok: true };
  });

const CondInput = z.object({
  gameId: z.string().uuid(),
  expected: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  reply: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
});

export const saveConditionalMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CondInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, fen, status, is_correspondence, chess960_start_fen, pgn")
      .eq("id", data.gameId)
      .single();
    if (!game) throw new Error("Game not found");
    if (userId !== game.white_id && userId !== game.black_id) throw new Error("Not a participant");
    if (game.status !== "active") throw new Error("Game is not active");
    if (!game.is_correspondence) throw new Error("Conditional moves are correspondence-only");

    // Validate the expected opponent move is legal now, and the reply legal after it.
    const chess = new Chess(game.fen);
    try {
      const exp = chess.move({
        from: data.expected.slice(0, 2),
        to: data.expected.slice(2, 4),
        promotion: (data.expected[4] as "q") ?? "q",
      });
      if (!exp) throw new Error("bad");
      const rep = chess.move({
        from: data.reply.slice(0, 2),
        to: data.reply.slice(2, 4),
        promotion: (data.reply[4] as "q") ?? "q",
      });
      if (!rep) throw new Error("bad");
    } catch {
      throw new Error("That expected move / reply pair is not legal from this position");
    }

    const { setConditional } = await import("@/lib/correspondence.server");
    await setConditional(data.gameId, userId, { expected: data.expected, reply: data.reply });
    return { ok: true };
  });

export const getConditionalMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { readConditional } = await import("@/lib/correspondence.server");
    try {
      return { conditional: await readConditional(data.gameId, context.userId) };
    } catch {
      return { conditional: null };
    }
  });

export const clearConditionalMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ gameId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { clearConditional } = await import("@/lib/correspondence.server");
    await clearConditional(data.gameId, context.userId).catch(() => undefined);
    return { ok: true };
  });
