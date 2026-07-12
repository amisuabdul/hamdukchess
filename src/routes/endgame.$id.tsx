import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getEndgameById } from "@/lib/endgames-data";
import { EndgameTrainer } from "@/components/endgames/EndgameTrainer";
import { recordEndgameAttempt } from "@/lib/endgames.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/endgame/$id")({
  loader: ({ params }) => {
    const eg = getEndgameById(params.id);
    if (!eg) throw notFound();
    return { endgame: eg };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Endgame not found — Hamduk Chess" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const eg = loaderData.endgame;
    return {
      meta: [
        { title: `${eg.title} — Endgame Training` },
        { name: "description", content: eg.description },
        { property: "og:title", content: `${eg.title} — Endgame Training` },
        { property: "og:description", content: eg.description },
      ],
    };
  },
  component: EndgameDetail,
  notFoundComponent: EndgameNotFound,
});

function EndgameDetail() {
  const { endgame } = Route.useLoaderData();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const record = useServerFn(recordEndgameAttempt);
  const navigate = useNavigate();

  const handleFinished = async (r: { completed: boolean; moveCount: number }) => {
    if (!user) return;
    try {
      await record({ data: { endgameId: endgame.id, completed: r.completed, moveCount: r.moveCount } });
      queryClient.invalidateQueries({ queryKey: ["my-endgame-progress"] });
    } catch (e) {
      console.error("record endgame attempt failed", e);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/endgame" })}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All endgames
        </button>
        <Link
          to="/learn"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Learning hub →
        </Link>
      </div>
      <EndgameTrainer endgame={endgame} onFinished={handleFinished} />
    </div>
  );
}

function EndgameNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold text-foreground">Endgame not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That position isn't in our library.
      </p>
      <Link
        to="/endgame"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Browse endgames
      </Link>
    </div>
  );
}
