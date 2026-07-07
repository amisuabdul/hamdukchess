import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ServerPuzzle = {
  id: string;
  fen: string;
  solution: string[];
  themes: string[];
  rating: number;
};

const UuidSchema = z.object({ puzzleId: z.string().uuid() });
const AttemptSchema = z.object({
  puzzleId: z.string().uuid(),
  success: z.boolean(),
});
const NextSchema = z
  .object({ theme: z.string().min(1).max(40).optional() })
  .optional()
  .transform((v) => v ?? {});
const DailySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Public — anyone (incl. guests) can fetch a puzzle. */
export const getPuzzleById = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => UuidSchema.parse(i))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { data: row, error } = await admin
      .from("puzzles")
      .select("id,fen,solution,themes,rating")
      .eq("id", data.puzzleId)
      .eq("approved", true)
      .maybeSingle();
    if (error) throw error;
    return row as ServerPuzzle | null;
  });

/** Public — deterministic daily puzzle for a date (auto-assigned on first request). */
export const getDailyPuzzle = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => DailySchema.parse(i))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const existing = await admin
      .from("puzzles")
      .select("id,fen,solution,themes,rating")
      .eq("daily_date", data.date)
      .maybeSingle();
    if (existing.data) return existing.data as ServerPuzzle;

    // Pick a deterministic puzzle for this date based on date hash, then claim it.
    const seed = [...data.date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const pool = await admin
      .from("puzzles")
      .select("id,fen,solution,themes,rating")
      .eq("approved", true)
      .is("daily_date", null)
      .gte("rating", 900)
      .lte("rating", 1600)
      .limit(50);
    if (pool.error) throw pool.error;
    if (!pool.data || pool.data.length === 0) return null;
    const pick = pool.data[seed % pool.data.length];
    await admin.from("puzzles").update({ daily_date: data.date }).eq("id", pick.id);
    return pick as ServerPuzzle;
  });

/** Authed — next puzzle for this user (Leitner-first, then unseen near rating). */
export const getNextPuzzle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => NextSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await getAdmin();

    // User rating (lazy-create)
    await admin.from("user_puzzle_stats").upsert({ user_id: userId }, { onConflict: "user_id" });
    const { data: stats } = await admin
      .from("user_puzzle_stats")
      .select("rating")
      .eq("user_id", userId)
      .maybeSingle();
    const rating = stats?.rating ?? 1200;

    // 1) Due Leitner items (failures or low boxes coming back today)
    const due = await supabase
      .from("puzzle_ratings")
      .select("puzzle_id")
      .lte("next_due_at", new Date().toISOString())
      .order("next_due_at", { ascending: true })
      .limit(10);

    if (due.data && due.data.length > 0) {
      const ids = due.data.map((r) => r.puzzle_id);
      let q = admin
        .from("puzzles")
        .select("id,fen,solution,themes,rating")
        .in("id", ids)
        .eq("approved", true);
      if (data.theme) q = q.contains("themes", [data.theme]);
      const { data: pz } = await q.limit(1);
      if (pz && pz[0]) return pz[0] as ServerPuzzle;
    }

    // 2) Unseen puzzles within ±200 of user rating
    const seen = await supabase.from("puzzle_ratings").select("puzzle_id");
    const seenIds = (seen.data ?? []).map((r) => r.puzzle_id);

    let q = admin
      .from("puzzles")
      .select("id,fen,solution,themes,rating")
      .eq("approved", true)
      .gte("rating", rating - 200)
      .lte("rating", rating + 200);
    if (seenIds.length > 0) q = q.not("id", "in", `(${seenIds.join(",")})`);
    if (data.theme) q = q.contains("themes", [data.theme]);
    const { data: rows } = await q.limit(20);

    if (rows && rows.length > 0) {
      return rows[Math.floor(Math.random() * rows.length)] as ServerPuzzle;
    }

    // 3) Fallback — any approved puzzle
    let fb = admin.from("puzzles").select("id,fen,solution,themes,rating").eq("approved", true);
    if (data.theme) fb = fb.contains("themes", [data.theme]);
    const { data: any2 } = await fb.limit(20);
    if (any2 && any2.length > 0) return any2[Math.floor(Math.random() * any2.length)] as ServerPuzzle;
    return null;
  });

/** Authed — record an attempt; returns new rating + Leitner state. */
export const submitPuzzleAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AttemptSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("submit_puzzle_attempt", {
      p_puzzle_id: data.puzzleId,
      p_success: data.success,
    });
    if (error) throw error;
    return res as {
      rating: number;
      delta: number;
      leitner_box: number;
      next_due_at: string;
    };
  });

/** Authed — current user stats. */
export const getMyPuzzleStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_puzzle_stats")
      .select("rating,solved_count,failed_count,current_streak,best_streak,last_solved_date")
      .eq("user_id", userId)
      .maybeSingle();
    return (
      data ?? {
        rating: 1200,
        solved_count: 0,
        failed_count: 0,
        current_streak: 0,
        best_streak: 0,
        last_solved_date: null,
      }
    );
  });

export type TacticsThemeStat = {
  theme: string;
  total: number;
  avgRating: number;
  attempted: number;
  solved: number;
  accuracy: number; // 0..1
  due: number;
};

/**
 * Public — list all tactical themes with pool size and (if signed in)
 * the caller's per-theme attempted/solved counts + due-for-review count.
 * Dynamic: pulls straight from the puzzles table, no static list.
 */
export const getTacticsThemes = createServerFn({ method: "GET" })
  .handler(async () => {
    const admin = await getAdmin();

    // 1) All approved puzzles: themes + rating (paged batches; table is small)
    const themeAgg = new Map<string, { total: number; ratingSum: number }>();
    const puzzleIdToThemes = new Map<string, string[]>();
    const PAGE = 1000;
    let from = 0;
    // Cap at 20k to stay bounded; adjust if pool grows.
    for (let i = 0; i < 20; i++) {
      const { data, error } = await admin
        .from("puzzles")
        .select("id,themes,rating")
        .eq("approved", true)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        const themes = (row.themes ?? []) as string[];
        puzzleIdToThemes.set(row.id as string, themes);
        for (const t of themes) {
          const cur = themeAgg.get(t) ?? { total: 0, ratingSum: 0 };
          cur.total += 1;
          cur.ratingSum += row.rating as number;
          themeAgg.set(t, cur);
        }
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // 2) If signed in, pull caller's attempts and split by theme.
    let userId: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: u } = await admin.auth.getUser(auth.slice(7));
        userId = u.user?.id ?? null;
      }
    } catch {
      // ignore — treat as anonymous
    }

    const userAgg = new Map<string, { attempted: number; solved: number; due: number }>();
    if (userId) {
      const nowIso = new Date().toISOString();
      const { data: attempts } = await admin
        .from("puzzle_ratings")
        .select("puzzle_id,attempts,successes,next_due_at")
        .eq("user_id", userId);
      for (const a of attempts ?? []) {
        const themes = puzzleIdToThemes.get(a.puzzle_id as string);
        if (!themes) continue;
        const attempted = (a.attempts as number) > 0 ? 1 : 0;
        const solved = (a.successes as number) > 0 ? 1 : 0;
        const due = a.next_due_at && (a.next_due_at as string) <= nowIso ? 1 : 0;
        for (const t of themes) {
          const cur = userAgg.get(t) ?? { attempted: 0, solved: 0, due: 0 };
          cur.attempted += attempted;
          cur.solved += solved;
          cur.due += due;
          userAgg.set(t, cur);
        }
      }
    }

    const rows: TacticsThemeStat[] = [];
    for (const [theme, s] of themeAgg) {
      const u = userAgg.get(theme) ?? { attempted: 0, solved: 0, due: 0 };
      rows.push({
        theme,
        total: s.total,
        avgRating: Math.round(s.ratingSum / s.total),
        attempted: u.attempted,
        solved: u.solved,
        accuracy: u.attempted > 0 ? u.solved / u.attempted : 0,
        due: u.due,
      });
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  });
