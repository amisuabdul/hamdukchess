import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { getTutorial } from "@/lib/tutorials-data";
import { TutorialPlayer } from "@/components/learn/TutorialPlayer";
import { getMyTutorialProgress, saveTutorialProgress } from "@/lib/tutorials.functions";
import { useAuth } from "@/lib/auth";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/learn/$tutorialId")({
  head: ({ params }) => {
    const t = getTutorial(params.tutorialId);
    const title = t ? `${t.title} — Learn Chess` : "Lesson — Learn Chess";
    const desc = t?.description ?? "Interactive chess tutorial.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Lesson failed to load: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Lesson not found.</p>
      <Link to="/learn" className="mt-4 inline-block underline text-primary">Back to lessons</Link>
    </div>
  ),
  loader: ({ params }) => {
    const tutorial = getTutorial(params.tutorialId);
    if (!tutorial) throw notFound();
    return { tutorialId: tutorial.id };
  },
  component: TutorialPage,
});

function TutorialPage() {
  const { tutorialId } = Route.useParams();
  const tutorial = getTutorial(tutorialId)!;

  const { user } = useAuth();
  const fetchProgress = useServerFn(getMyTutorialProgress);
  const save = useServerFn(saveTutorialProgress);
  const lastSavedStep = useRef<number>(-1);

  const { data: progress } = useQuery({
    queryKey: ["tutorial-progress", user?.id],
    queryFn: () => fetchProgress(),
    enabled: !!user,
  });

  const existing = progress?.find((p) => p.tutorial_id === tutorial.id);
  const initialStep = existing?.completed ? 0 : existing?.step_index ?? 0;

  const persistStep = (index: number) => {
    if (!user || lastSavedStep.current === index) return;
    lastSavedStep.current = index;
    save({ data: { tutorial_id: tutorial.id, step_index: index, completed: false } }).catch(
      () => {},
    );
  };

  const persistComplete = () => {
    if (!user) return;
    save({
      data: {
        tutorial_id: tutorial.id,
        step_index: tutorial.steps.length - 1,
        completed: true,
      },
    }).catch(() => {});
  };

  useEffect(() => {
    // Reset guard when tutorial changes
    lastSavedStep.current = -1;
  }, [tutorial.id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-4">
        <Link
          to="/learn"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All lessons
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold text-foreground">{tutorial.title}</h1>
        <p className="text-sm text-muted-foreground">{tutorial.description}</p>
      </div>

      <TutorialPlayer
        key={tutorial.id}
        tutorial={tutorial}
        initialStep={initialStep}
        onStepChange={persistStep}
        onComplete={persistComplete}
      />
    </div>
  );
}
