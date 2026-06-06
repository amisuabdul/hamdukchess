import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ServerPuzzle } from "@/lib/puzzles.functions";

const StreamSchema = z
  .object({
    count: z.number().int().min(5).max(60).default(40),
    minRating: z.number().int().min(400).max(3000).default(700),
    maxRating: z.number().int().min(400).max(3000).default(1800),
  })
  .partial()
  .transform((v) => ({
    count: v.count ?? 40,
    minRating: v.minRating ?? 700,
    maxRating: v.maxRating ?? 1800,
  }));

const SubmitSchema = z.object({
  score: z.number().int().min(0).max(500),
  solved: z.number().int().min(0).max(500),
  mistakes: z.number().int().min(0).max(50),
  durationSec: z.number().int().min(10).max(600).default(180),
});

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertPlusOrGold(userId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  const tier = (data?.subscription_tier ?? "free") as "free" | "plus" | "gold";
  if (tier === "free") {
    throw new Error("Puzzle Storm is a Plus / Gold feature. Upgrade to play.");
  }
  return tier;
}

/** Authed (Plus/Gold) — pulls an unseen-friendly puzzle stream for the run. */
export const getStormStream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => StreamSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertPlusOrGold(context.userId);
    const admin = await getAdmin();
    const { data: rows, error } = await admin
      .from("puzzles")
      .select("id,fen,solution,themes,rating")
      .eq("approved", true)
      .gte("rating", data.minRating)
      .lte("rating", data.maxRating)
      .limit(data.count * 3);
    if (error) throw error;
    const list = (rows ?? []) as ServerPuzzle[];
    // Shuffle then trim
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // Sort ascending by rating for warm-up curve
    const trimmed = list.slice(0, data.count).sort((a, b) => a.rating - b.rating);
    return { puzzles: trimmed };
  });

export type StormResult = {
  score: number;
  rank: { daily: number | null; allTime: number | null };
  personalBest: number;
};

/** Authed — persist a finished storm run, update Redis leaderboards. */
export const submitStormResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data, context }): Promise<StormResult> => {
    const { supabase, userId } = context;
    await assertPlusOrGold(userId);

    const { error } = await supabase.from("puzzle_storm_scores").insert({
      user_id: userId,
      score: data.score,
      solved: data.solved,
      mistakes: data.mistakes,
      duration_sec: data.durationSec,
      mode: "3min",
    });
    if (error) throw error;

    // Redis leaderboards — best-effort.
    let dailyRank: number | null = null;
    let allTimeRank: number | null = null;
    try {
      const { redis } = await import("@/lib/redis.server");
      const today = new Date().toISOString().slice(0, 10);
      const dailyKey = `storm:lb:daily:${today}`;
      const allKey = `storm:lb:alltime`;
      // Keep best score per user
      const [curDaily, curAll] = await Promise.all([
        redis.zscore(dailyKey, userId),
        redis.zscore(allKey, userId),
      ]);
      if (curDaily == null || data.score > Number(curDaily)) {
        await redis.zadd(dailyKey, { score: data.score, member: userId });
        await redis.expire(dailyKey, 60 * 60 * 48);
      }
      if (curAll == null || data.score > Number(curAll)) {
        await redis.zadd(allKey, { score: data.score, member: userId });
      }
      const [dRank, aRank] = await Promise.all([
        redis.zrevrank(dailyKey, userId),
        redis.zrevrank(allKey, userId),
      ]);
      dailyRank = dRank == null ? null : Number(dRank) + 1;
      allTimeRank = aRank == null ? null : Number(aRank) + 1;
    } catch (e) {
      console.warn("storm leaderboard skipped:", e);
    }

    const admin = await getAdmin();
    const { data: best } = await admin
      .from("puzzle_storm_scores")
      .select("score")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      score: data.score,
      rank: { daily: dailyRank, allTime: allTimeRank },
      personalBest: best?.score ?? data.score,
    };
  });

export type StormLeaderEntry = {
  user_id: string;
  username: string;
  score: number;
};

const LbSchema = z
  .object({ scope: z.enum(["daily", "alltime"]).default("daily"), limit: z.number().int().min(1).max(50).default(20) })
  .partial()
  .transform((v) => ({ scope: v.scope ?? "daily", limit: v.limit ?? 20 }));

/** Public — fetch the top N from Redis, hydrate usernames from Postgres. */
export const getStormLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => LbSchema.parse(i))
  .handler(async ({ data }): Promise<StormLeaderEntry[]> => {
    let pairs: Array<{ user_id: string; score: number }> = [];
    try {
      const { redis } = await import("@/lib/redis.server");
      const today = new Date().toISOString().slice(0, 10);
      const key = data.scope === "daily" ? `storm:lb:daily:${today}` : `storm:lb:alltime`;
      const raw = (await redis.zrange(key, 0, data.limit - 1, {
        rev: true,
        withScores: true,
      })) as (string | number)[];
      for (let i = 0; i < raw.length; i += 2) {
        pairs.push({ user_id: String(raw[i]), score: Number(raw[i + 1]) });
      }
    } catch (e) {
      console.warn("storm leaderboard read skipped, falling back to db:", e);
    }

    const admin = await getAdmin();
    if (pairs.length === 0) {
      // Fallback to Postgres (max score per user)
      const since = data.scope === "daily"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : new Date(0).toISOString();
      const { data: rows } = await admin
        .from("puzzle_storm_scores")
        .select("user_id,score")
        .gte("played_at", since)
        .order("score", { ascending: false })
        .limit(data.limit * 4);
      const best = new Map<string, number>();
      for (const r of rows ?? []) {
        if (!best.has(r.user_id) || (best.get(r.user_id) ?? 0) < r.score) best.set(r.user_id, r.score);
      }
      pairs = Array.from(best.entries())
        .map(([user_id, score]) => ({ user_id, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, data.limit);
    }

    if (pairs.length === 0) return [];
    const ids = pairs.map((p) => p.user_id);
    const { data: profs } = await admin.from("profiles").select("id,username").in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id, p.username]));
    return pairs.map((p) => ({
      user_id: p.user_id,
      username: byId.get(p.user_id) ?? "player",
      score: p.score,
    }));
  });

/** Authed — personal stats for storm. */
export const getMyStormStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data: rows } = await admin
      .from("puzzle_storm_scores")
      .select("score,solved,mistakes,played_at")
      .eq("user_id", context.userId)
      .order("played_at", { ascending: false })
      .limit(20);
    const list = rows ?? [];
    const best = list.reduce((m, r) => Math.max(m, r.score), 0);
    return { best, runs: list.length, recent: list };
  });
