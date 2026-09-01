// Server-only helpers for correspondence chess: conditional moves (Redis) and
// the deadline sweep that auto-flags players who miss their move window.
import { Chess } from "chess.js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { redis } from "./redis.server";

const COND_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const GRACE_MS = 60 * 60 * 1000; // 1h grace after deadline

export type Conditional = { expected: string; reply: string };

function condKey(gameId: string, userId: string) {
  return `cond:${gameId}:${userId}`;
}

export async function setConditional(gameId: string, userId: string, c: Conditional) {
  await redis.set(condKey(gameId, userId), JSON.stringify(c), { ex: COND_TTL_SEC });
}

export async function readConditional(gameId: string, userId: string): Promise<Conditional | null> {
  const raw = await redis.get<string | Conditional>(condKey(gameId, userId));
  if (!raw) return null;
  try {
    return typeof raw === "string" ? (JSON.parse(raw) as Conditional) : raw;
  } catch {
    return null;
  }
}

export async function clearConditional(gameId: string, userId: string) {
  await redis.del(condKey(gameId, userId));
}

/**
 * If the user has a conditional move stored whose expected opponent move
 * matches `playedUci`, return the reply and consume the entry.
 */
export async function consumeConditional(
  gameId: string,
  userId: string,
  playedUci: string,
): Promise<string | null> {
  let cond: Conditional | null = null;
  try {
    cond = await readConditional(gameId, userId);
  } catch {
    return null; // Redis unavailable — conditional moves are best-effort
  }
  if (!cond) return null;
  await clearConditional(gameId, userId).catch(() => undefined);
  return cond.expected.toLowerCase() === playedUci.toLowerCase() ? cond.reply : null;
}

/** Deadline in ms for the next move of a correspondence game. */
export function nextDeadline(daysPerMove: number, from = Date.now()): string {
  return new Date(from + daysPerMove * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Auto-flags overdue correspondence games (deadline + 1h grace).
 * Players on vacation get their deadline pushed instead of losing.
 */
export async function sweepCorrespondenceDeadlines(): Promise<{
  checked: number;
  flagged: number;
  deferred: number;
}> {
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const { data: games, error } = await supabaseAdmin
    .from("games")
    .select("id, white_id, black_id, fen, status, move_deadline, days_per_move")
    .eq("status", "active")
    .eq("is_correspondence", true)
    .not("move_deadline", "is", null)
    .lt("move_deadline", cutoff)
    .limit(200);
  if (error) throw new Error(error.message);

  let flagged = 0;
  let deferred = 0;
  for (const g of games ?? []) {
    let turn: "w" | "b" = "w";
    try {
      turn = new Chess(g.fen).turn();
    } catch {
      turn = (g.fen.split(" ")[1] as "w" | "b") ?? "w";
    }
    const loserId = turn === "w" ? g.white_id : g.black_id;

    const { data: loser } = await supabaseAdmin
      .from("profiles")
      .select("vacation_until")
      .eq("id", loserId)
      .maybeSingle();
    if (loser?.vacation_until && new Date(loser.vacation_until).getTime() > Date.now()) {
      // Clock paused — push the deadline to just after vacation ends.
      await supabaseAdmin
        .from("games")
        .update({
          move_deadline: nextDeadline(
            g.days_per_move ?? 1,
            new Date(loser.vacation_until).getTime(),
          ),
        })
        .eq("id", g.id);
      deferred++;
      continue;
    }

    const result = turn === "w" ? "black" : "white";
    const winnerId = turn === "w" ? g.black_id : g.white_id;
    await supabaseAdmin
      .from("games")
      .update({
        status: "completed",
        result,
        winner_id: winnerId,
        end_reason: "timeout",
        ended_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    await supabaseAdmin.from("game_events").insert({
      game_id: g.id,
      type: "correspondence_timeout",
      by_user: null,
      payload: { loser: turn },
    });
    await supabaseAdmin.rpc("apply_elo", {
      p_white: g.white_id,
      p_black: g.black_id,
      p_result: result,
      p_game_id: g.id,
    });
    const { emitGameCompleted } = await import("@/lib/game-webhooks.server");
    await emitGameCompleted(g.id);
    flagged++;
  }

  return { checked: (games ?? []).length, flagged, deferred };
}
