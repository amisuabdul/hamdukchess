import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOpeningById } from "@/lib/openings-data";
import { OpeningTrainer } from "@/components/openings/OpeningTrainer";
import {
  addToRepertoire,
  getMyOpeningProgress,
  getMyRepertoire,
  recordOpeningSession,
  removeFromRepertoire,
  type OpeningProgress,
} from "@/lib/openings.functions";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, BookmarkPlus, BookmarkCheck, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/openings/$eco")({
  head: ({ params }) => {
    const op = getOpeningById(params.eco);
    const title = op ? `${op.name} — Openings Trainer` : "Opening — Hamduk Chess";
    return {
      meta: [
        { title },
        { name: "description", content: op?.description ?? "Learn this chess opening line by line." },
      ],
    };
  },
  component: OpeningPage,
});

function OpeningPage() {
  const { eco } = Route.useParams();
  const opening = getOpeningById(eco);
  if (!opening) throw notFound();

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const record = useServerFn(recordOpeningSession);
  const fetchProgress = useServerFn(getMyOpeningProgress);
  const fetchRepertoire = useServerFn(getMyRepertoire);
  const addRep = useServerFn(addToRepertoire);
  const removeRep = useServerFn(removeFromRepertoire);

  const { data: progress = [] } = useQuery({
    queryKey: ["my-opening-progress"],
    queryFn: () => fetchProgress() as Promise<OpeningProgress[]>,
    enabled: !!user,
  });
  const myProg = progress.find((p) => p.eco === eco);

  const { data: repertoire = [] } = useQuery({
    queryKey: ["my-repertoire"],
    queryFn: () => fetchRepertoire() as Promise<Array<{ id: string; eco: string; color: string }>>,
    enabled: !!user,
  });
  const rep = repertoire.find((r) => r.eco === eco && r.color === opening.color);

  const [tier, setTier] = useState<string | null>(null);
  useState(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setTier((data?.subscription_tier as string) ?? null));
  });
  const isGold = tier === "gold";

  const [repMsg, setRepMsg] = useState<string | null>(null);

  const onSessionComplete = useCallback(
    async (r: { correct: number; attempts: number; masteredDepth: number }) => {
      if (!user) return;
      try {
        await record({
          data: {
            eco: opening.eco,
            correct: r.correct,
            attempts: r.attempts,
            masteredDepth: r.masteredDepth,
          },
        });
        queryClient.invalidateQueries({ queryKey: ["my-opening-progress"] });
      } catch (e) {
        console.error(e);
      }
    },
    [user, record, opening.eco, queryClient],
  );

  const toggleRepertoire = async () => {
    if (!user) return;
    setRepMsg(null);
    try {
      if (rep) {
        await removeRep({ data: { id: rep.id } });
      } else {
        await addRep({ data: { eco: opening.eco, color: opening.color } });
      }
      queryClient.invalidateQueries({ queryKey: ["my-repertoire"] });
    } catch (e) {
      setRepMsg(e instanceof Error ? e.message : "Failed to update repertoire.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/openings"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All openings
        </Link>

        {user && (
          isGold ? (
            <button
              onClick={toggleRepertoire}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors " +
                (rep
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border bg-card text-foreground hover:bg-accent")
              }
            >
              {rep ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5" /> In your repertoire
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" /> Add to repertoire
                </>
              )}
            </button>
          ) : (
            <Link
              to="/billing"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
              title="Personal repertoire is a Gold feature"
            >
              <Lock className="h-3.5 w-3.5" /> Save to repertoire (Gold)
            </Link>
          )
        )}
      </div>

      {repMsg && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {repMsg}
        </div>
      )}

      {myProg && (
        <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Best depth: <span className="font-semibold text-foreground">{myProg.mastered_depth}/{opening.moves.length}</span>
          {" · "}
          {myProg.attempts > 0
            ? `${Math.round((myProg.correct / myProg.attempts) * 100)}% accuracy over ${myProg.attempts} attempts`
            : "no attempts yet"}
        </div>
      )}

      <OpeningTrainer key={opening.eco} opening={opening} onSessionComplete={onSessionComplete} />
    </div>
  );
}
