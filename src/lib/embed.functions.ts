import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type EmbedConfig = {
  theme?: "light" | "dark" | "auto";
  orientation?: "white" | "black";
  fen?: string;
  game_id?: string;
  puzzle_id?: string;
  interactive?: boolean;
  show_controls?: boolean;
  size?: number;
  responsive?: boolean;
  session_id?: string;
};

/** Public: resolves an embed token into everything the widget needs to render. */
export const getEmbedPayload = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("embed_tokens")
      .select("token, kind, config, owner_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) return { error: "not_found" as const };
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { error: "expired" as const };
    }

    const config = (row.config ?? {}) as EmbedConfig;
    const kind = row.kind as "board" | "puzzle" | "leaderboard" | "game";

    if (kind === "board") {
      let fen = config.fen ?? START_FEN;
      let locked = false;
      if (config.session_id) {
        const { data: session } = await supabaseAdmin
          .from("class_sessions")
          .select("position_fen, locked, status")
          .eq("id", config.session_id)
          .maybeSingle();
        if (session) {
          fen = session.position_fen;
          locked = session.locked;
        }
      }
      return { kind, config, data: { fen, locked, sessionId: config.session_id ?? null } };
    }

    if (kind === "puzzle") {
      const query = supabaseAdmin
        .from("puzzles")
        .select("id, fen, solution, themes, rating")
        .eq("approved", true);
      const { data: puzzle } = config.puzzle_id
        ? await query.eq("id", config.puzzle_id).maybeSingle()
        : await query
            .not("daily_date", "is", null)
            .order("daily_date", { ascending: false })
            .limit(1)
            .maybeSingle();
      if (!puzzle) return { error: "not_found" as const };
      return { kind, config, data: { puzzle } };
    }

    if (kind === "leaderboard") {
      const { data: members } = await supabaseAdmin
        .from("org_members")
        .select("user_id")
        .eq("org_owner_id", row.owner_id);
      const ids = [row.owner_id, ...(members ?? []).map((m) => m.user_id)];
      const { data: people } = await supabaseAdmin
        .from("profiles")
        .select("id, username, country, rating, games_played, wins, losses, draws")
        .in("id", ids)
        .order("rating", { ascending: false })
        .limit(50);
      return { kind, config, data: { players: people ?? [] } };
    }

    // Live game spectator view
    const gameId = config.game_id;
    if (!gameId) return { error: "not_found" as const };
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, fen, pgn, status, result, time_control, ply")
      .eq("id", gameId)
      .maybeSingle();
    if (!game) return { error: "not_found" as const };
    const { data: players } = await supabaseAdmin
      .from("profiles")
      .select("id, username, rating")
      .in("id", [game.white_id, game.black_id]);
    const byId = new Map((players ?? []).map((p) => [p.id, p]));
    return {
      kind,
      config,
      data: {
        game: {
          id: game.id,
          fen: game.fen,
          pgn: game.pgn,
          status: game.status,
          result: game.result,
          timeControl: game.time_control,
          ply: game.ply,
          white: byId.get(game.white_id) ?? null,
          black: byId.get(game.black_id) ?? null,
        },
      },
    };
  });

/** Public: a student board inside a class embed reports its state for the grid dashboard. */
export const reportStudentBoard = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: z.string().min(8).max(80),
        label: z.string().min(1).max(80).default("Student"),
        fen: z.string().min(10).max(120),
        movesMade: z.number().int().min(0).max(500).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("embed_tokens")
      .select("config, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false };
    if (row.expires_at && new Date(row.expires_at) < new Date()) return { ok: false };
    const sessionId = (row.config as EmbedConfig)?.session_id;
    if (!sessionId) return { ok: false };

    const { data: existing } = await supabaseAdmin
      .from("class_session_students")
      .select("id")
      .eq("session_id", sessionId)
      .eq("label", data.label)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("class_session_students")
        .update({
          board_fen: data.fen,
          moves_made: data.movesMade,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("class_session_students").insert({
        session_id: sessionId,
        label: data.label,
        board_fen: data.fen,
        moves_made: data.movesMade,
      });
    }
    return { ok: true };
  });
