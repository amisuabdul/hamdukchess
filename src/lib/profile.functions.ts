import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UsernameSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/i),
});

export const getProfileByUsername = createServerFn({ method: "GET" })
  .inputValidator((d) => UsernameSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, country, rating, games_played, wins, losses, draws, created_at")
      .eq("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) return { profile: null, games: [], rank: null };

    // Recent games (last 20)
    const { data: games, error: gErr } = await supabaseAdmin
      .from("games")
      .select("id, white_id, black_id, result, status, end_reason, time_control, created_at, ended_at, ply")
      .or(`white_id.eq.${profile.id},black_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (gErr) throw new Error(gErr.message);

    // Look up opponent usernames in one query
    const opponentIds = Array.from(
      new Set(
        (games ?? [])
          .map((g) => (g.white_id === profile.id ? g.black_id : g.white_id))
          .filter(Boolean),
      ),
    );
    let opponents: Record<string, { username: string; rating: number }> = {};
    if (opponentIds.length > 0) {
      const { data: opps } = await supabaseAdmin
        .from("profiles")
        .select("id, username, rating")
        .in("id", opponentIds);
      for (const o of opps ?? []) {
        opponents[o.id] = { username: o.username, rating: o.rating };
      }
    }

    // Global rank (count of profiles with higher rating + 1)
    const { count: higher } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gt("rating", profile.rating);
    const rank = (higher ?? 0) + 1;

    return {
      profile,
      rank,
      games: (games ?? []).map((g) => {
        const isWhite = g.white_id === profile.id;
        const opponentId = isWhite ? g.black_id : g.white_id;
        const opp = opponents[opponentId] ?? { username: "—", rating: 0 };
        let outcome: "win" | "loss" | "draw" | "ongoing" = "ongoing";
        if (g.status === "completed") {
          if (g.result === "draw") outcome = "draw";
          else if ((g.result === "white" && isWhite) || (g.result === "black" && !isWhite)) outcome = "win";
          else outcome = "loss";
        }
        return {
          id: g.id,
          color: isWhite ? "white" : "black",
          opponent: opp.username,
          opponentRating: opp.rating,
          outcome,
          timeControl: g.time_control,
          endReason: g.end_reason,
          ply: g.ply,
          createdAt: g.created_at,
          endedAt: g.ended_at,
        };
      }),
    };
  });
