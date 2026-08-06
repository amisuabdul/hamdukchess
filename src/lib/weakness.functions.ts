import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyWeaknessReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("weakness_reports")
      .select(
        "games_analyzed, piece_blunders, phase_errors, opening_gaps, capture_heatmap, suggestions, summary, computed_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { report: data ?? null };
  });

export const recomputeMyWeaknessReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.subscription_tier !== "gold") {
      throw new Error("Weakness detection is a Gold feature. Upgrade to unlock it.");
    }

    const { computeWeaknessReport, summarizeReport } = await import("@/lib/weakness.server");
    const report = await computeWeaknessReport(context.userId);
    report.summary = await summarizeReport(report);

    const { error } = await supabaseAdmin.from("weakness_reports").upsert(
      {
        user_id: context.userId,
        games_analyzed: report.games_analyzed,
        piece_blunders: report.piece_blunders as never,
        phase_errors: report.phase_errors as never,
        opening_gaps: report.opening_gaps as never,
        capture_heatmap: report.capture_heatmap as never,
        suggestions: report.suggestions as never,
        summary: report.summary,
        computed_at: report.computed_at,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    return { report };
  });
