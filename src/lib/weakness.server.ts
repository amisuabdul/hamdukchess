import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PieceKey = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export type Phase = "opening" | "middlegame" | "endgame";

export type WeaknessSuggestion = {
  title: string;
  detail: string;
  href: string;
};

export type WeaknessReport = {
  games_analyzed: number;
  piece_blunders: Record<string, number>;
  phase_errors: Record<string, { errors: number; moves: number }>;
  opening_gaps: Array<{ eco: string; name: string; games: number; win_rate: number }>;
  capture_heatmap: Record<string, number>;
  suggestions: WeaknessSuggestion[];
  summary: string | null;
  computed_at: string;
};

const SEVERE = new Set(["inaccuracy", "mistake", "blunder"]);

function pieceFromSan(san: string): PieceKey {
  if (san.startsWith("O-O")) return "king";
  const c = san[0];
  if (c === "N") return "knight";
  if (c === "B") return "bishop";
  if (c === "R") return "rook";
  if (c === "Q") return "queen";
  if (c === "K") return "king";
  return "pawn";
}

function phaseOfPly(ply: number, totalPly: number): Phase {
  if (ply <= 20) return "opening";
  if (totalPly - ply <= 20 || ply > 60) return "endgame";
  return "middlegame";
}

type ClassificationEntry = { ply: number; classification: string };

/** game_analysis.classifications has been written in a few shapes; normalize defensively. */
function normalizeClassifications(raw: unknown): ClassificationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): ClassificationEntry | null => {
      if (typeof item === "string") return { ply: index + 1, classification: item };
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const cls = typeof rec.classification === "string" ? rec.classification : null;
        if (!cls) return null;
        const ply = typeof rec.ply === "number" ? rec.ply : index + 1;
        return { ply, classification: cls };
      }
      return null;
    })
    .filter((v): v is ClassificationEntry => v !== null);
}

export async function computeWeaknessReport(userId: string): Promise<WeaknessReport> {
  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, white_id, black_id, result, winner_id, ply, status, created_at")
    .or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .eq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(50);
  if (gamesError) throw new Error(gamesError.message);

  const list = games ?? [];
  const gameIds = list.map((g) => g.id);
  const colorOf = new Map(list.map((g) => [g.id, g.white_id === userId ? "w" : "b"] as const));
  const totalPlyOf = new Map(list.map((g) => [g.id, g.ply ?? 0] as const));

  const pieceBlunders: Record<string, number> = {};
  const phaseErrors: Record<string, { errors: number; moves: number }> = {
    opening: { errors: 0, moves: 0 },
    middlegame: { errors: 0, moves: 0 },
    endgame: { errors: 0, moves: 0 },
  };
  const heatmap: Record<string, number> = {};
  const ecoStats = new Map<string, { name: string; games: number; wins: number; draws: number }>();

  if (gameIds.length > 0) {
    const { data: moves } = await supabaseAdmin
      .from("moves")
      .select("game_id, ply, san, uci, by_user")
      .in("game_id", gameIds)
      .order("ply", { ascending: true });

    const movesByGame = new Map<string, typeof moves>();
    for (const m of moves ?? []) {
      const arr = movesByGame.get(m.game_id) ?? [];
      arr.push(m);
      movesByGame.set(m.game_id, arr as never);
    }

    // Capture heatmap: squares where the player's pieces were captured.
    for (const m of moves ?? []) {
      if (m.by_user === userId) continue;
      if (!m.san.includes("x")) continue;
      const square = (m.uci ?? "").slice(2, 4);
      if (square.length === 2) heatmap[square] = (heatmap[square] ?? 0) + 1;
    }

    const { data: analyses } = await supabaseAdmin
      .from("game_analysis")
      .select("game_id, classifications, opening_eco, opening_name")
      .in("game_id", gameIds);

    for (const a of analyses ?? []) {
      const color = colorOf.get(a.game_id);
      if (!color) continue;
      const totalPly = totalPlyOf.get(a.game_id) ?? 0;
      const entries = normalizeClassifications(a.classifications);
      const gameMoves = movesByGame.get(a.game_id) ?? [];
      const sanByPly = new Map((gameMoves ?? []).map((m) => [m.ply, m.san] as const));

      for (const entry of entries) {
        const isMine = color === "w" ? entry.ply % 2 === 1 : entry.ply % 2 === 0;
        if (!isMine) continue;
        const phase = phaseOfPly(entry.ply, totalPly);
        phaseErrors[phase].moves += 1;
        if (!SEVERE.has(entry.classification)) continue;
        phaseErrors[phase].errors += 1;
        const san = sanByPly.get(entry.ply);
        if (san) {
          const piece = pieceFromSan(san);
          pieceBlunders[piece] = (pieceBlunders[piece] ?? 0) + 1;
        }
      }
    }

    // Opening gaps from analyzed ECO codes
    const ecoByGame = new Map(
      (analyses ?? [])
        .filter((a) => a.opening_eco)
        .map((a) => [a.game_id, { eco: a.opening_eco as string, name: a.opening_name ?? "" }]),
    );
    for (const g of list) {
      const eco = ecoByGame.get(g.id);
      if (!eco) continue;
      const stat = ecoStats.get(eco.eco) ?? { name: eco.name, games: 0, wins: 0, draws: 0 };
      stat.games += 1;
      if (g.result === "draw") stat.draws += 1;
      else if (g.winner_id === userId) stat.wins += 1;
      ecoStats.set(eco.eco, stat);
    }
  }

  const openingGaps = Array.from(ecoStats.entries())
    .filter(([, s]) => s.games >= 3)
    .map(([eco, s]) => ({
      eco,
      name: s.name,
      games: s.games,
      win_rate: Math.round(((s.wins + s.draws * 0.5) / s.games) * 1000) / 10,
    }))
    .filter((o) => o.win_rate < 45)
    .sort((a, b) => a.win_rate - b.win_rate)
    .slice(0, 5);

  const suggestions = buildSuggestions({ pieceBlunders, phaseErrors, openingGaps, heatmap });

  return {
    games_analyzed: list.length,
    piece_blunders: pieceBlunders,
    phase_errors: phaseErrors,
    opening_gaps: openingGaps,
    capture_heatmap: heatmap,
    suggestions,
    summary: null,
    computed_at: new Date().toISOString(),
  };
}

function buildSuggestions(input: {
  pieceBlunders: Record<string, number>;
  phaseErrors: Record<string, { errors: number; moves: number }>;
  openingGaps: Array<{ eco: string; name: string; games: number; win_rate: number }>;
  heatmap: Record<string, number>;
}): WeaknessSuggestion[] {
  const out: WeaknessSuggestion[] = [];

  const worstPiece = Object.entries(input.pieceBlunders).sort((a, b) => b[1] - a[1])[0];
  if (worstPiece && worstPiece[1] > 0) {
    const themeByPiece: Record<string, string> = {
      knight: "fork",
      bishop: "pin",
      rook: "skewer",
      queen: "hangingPiece",
      pawn: "advancedPawn",
      king: "mateIn2",
    };
    const theme = themeByPiece[worstPiece[0]] ?? "fork";
    out.push({
      title: `Tighten up your ${worstPiece[0]} play`,
      detail: `Most of your costly moves involved your ${worstPiece[0]} (${worstPiece[1]} in the games reviewed). Drill tactics where that piece is the hero or the victim.`,
      href: `/tactics/${theme}`,
    });
  }

  const phases = Object.entries(input.phaseErrors)
    .map(([phase, s]) => ({ phase, rate: s.moves > 0 ? s.errors / s.moves : 0, ...s }))
    .sort((a, b) => b.rate - a.rate);
  const worstPhase = phases[0];
  if (worstPhase && worstPhase.errors > 0) {
    if (worstPhase.phase === "endgame") {
      out.push({
        title: "Your endgames are leaking points",
        detail: `${Math.round(worstPhase.rate * 100)}% of your endgame moves were inaccurate or worse. Rook and king-and-pawn technique pays back fastest.`,
        href: "/endgame",
      });
    } else if (worstPhase.phase === "opening") {
      out.push({
        title: "Firm up your opening knowledge",
        detail: `You drift early — ${Math.round(worstPhase.rate * 100)}% of your first 20 moves lost ground. Learn a small, repeatable repertoire.`,
        href: "/openings",
      });
    } else {
      out.push({
        title: "Work on middlegame calculation",
        detail: `Most of your errors land in the middlegame (${Math.round(worstPhase.rate * 100)}% of those moves). Daily puzzles sharpen exactly this.`,
        href: "/puzzles",
      });
    }
  }

  for (const gap of input.openingGaps.slice(0, 2)) {
    out.push({
      title: `Study ${gap.name || gap.eco}`,
      detail: `You score only ${gap.win_rate}% across ${gap.games} games in this opening. Review the mainline and typical plans.`,
      href: `/openings/${gap.eco}`,
    });
  }

  const hottest = Object.entries(input.heatmap).sort((a, b) => b[1] - a[1])[0];
  if (hottest) {
    out.push({
      title: `Watch the ${hottest[0]} square`,
      detail: `Your pieces were captured on ${hottest[0]} more than anywhere else (${hottest[1]} times). Before moving there, check every enemy attacker.`,
      href: "/puzzles",
    });
  }

  if (out.length === 0) {
    out.push({
      title: "Play a few more rated games",
      detail: "There isn't enough analysed data yet. Play and review a few games, then recompute your report.",
      href: "/lobby",
    });
  }

  return out.slice(0, 5);
}

/** Plain-language summary of the report, written by Lovable AI. Best-effort. */
export async function summarizeReport(report: WeaknessReport): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || report.games_analyzed === 0) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a friendly chess coach. In at most 120 words of plain language (no engine jargon, no markdown headings), summarize what this player should fix first and why. Speak directly to the player.",
          },
          {
            role: "user",
            content: JSON.stringify({
              games_analyzed: report.games_analyzed,
              piece_blunders: report.piece_blunders,
              phase_errors: report.phase_errors,
              opening_gaps: report.opening_gaps,
              top_capture_squares: Object.entries(report.capture_heatmap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6),
            }).slice(0, 4000),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[weakness] summary failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    console.error("[weakness] summary error", e);
    return null;
  }
}
