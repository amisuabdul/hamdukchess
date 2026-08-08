import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getMyBilling } from "@/lib/ratings.functions";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listVideoLessons,
  getMyVideoProgress,
  recordVideoProgress,
  type VideoLesson,
  type VideoProgress,
} from "@/lib/videos.functions";
import { VideoPlayer } from "@/components/lessons/VideoPlayer";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Check, Clock, Lock, User } from "lucide-react";

export const Route = createFileRoute("/lessons/$id")({
  head: () => ({
    meta: [
      { title: "Lesson — Hamduk Chess" },
      { name: "description", content: "Watch a chess video lesson and track your progress." },
    ],
  }),
  component: LessonPage,
});

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function LessonPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchLessons = useServerFn(listVideoLessons);
  const fetchProgress = useServerFn(getMyVideoProgress);
  const record = useServerFn(recordVideoProgress);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["video-lessons"],
    queryFn: () => fetchLessons() as Promise<VideoLesson[]>,
  });
  const lesson = lessons.find((l) => l.id === id);

  const { data: progress = [] } = useQuery({
    queryKey: ["my-video-progress"],
    queryFn: () => fetchProgress() as Promise<VideoProgress[]>,
    enabled: !!user,
  });
  const myProg = progress.find((p) => p.video_id === id);

  const [tier, setTier] = useState<string | null>(null);
  const loadBilling = useServerFn(getMyBilling);
  useEffect(() => {
    if (!user) return;
    void loadBilling({})
      .then((b) => setTier(b.tier))
      .catch(() => setTier(null));
  }, [user, loadBilling]);
  const isGold = tier === "gold";

  // Auto-record "started" on first load for iframe sources
  useEffect(() => {
    if (!user || !lesson) return;
    if (lesson.source === "cloud") return; // cloud player handles its own tracking
    if (myProg) return;
    record({ data: { videoId: lesson.id, positionSec: 0, completed: false } }).catch(() => {});
  }, [user, lesson, myProg, record]);

  if (isLoading && lessons.length === 0) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!lesson && !isLoading) throw notFound();
  if (!lesson) return null;

  const canWatchPremium = !lesson.is_premium || isGold;

  const markComplete = async () => {
    if (!user) return;
    await record({
      data: { videoId: lesson.id, positionSec: lesson.duration_sec, completed: true },
    });
    queryClient.invalidateQueries({ queryKey: ["my-video-progress"] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-24 md:pb-8">
      <Link
        to="/lessons"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> All lessons
      </Link>

      <VideoPlayer
        videoId={lesson.id}
        source={lesson.source}
        externalId={lesson.external_id}
        isPremium={lesson.is_premium}
        canWatchPremium={canWatchPremium}
        initialPosition={myProg?.position_sec ?? 0}
        authed={!!user}
        onProgress={() => queryClient.invalidateQueries({ queryKey: ["my-video-progress"] })}
      />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
              {lesson.category}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {lesson.difficulty}
            </span>
            {lesson.is_premium && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                <Lock className="h-3 w-3" /> Gold
              </span>
            )}
          </div>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight">{lesson.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {lesson.instructor && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {lesson.instructor}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatDuration(lesson.duration_sec)}
            </span>
          </div>
        </div>

        {user && canWatchPremium && (
          <button
            onClick={markComplete}
            disabled={myProg?.completed}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-default disabled:opacity-70"
          >
            <Check className="h-3.5 w-3.5" />
            {myProg?.completed ? "Completed" : "Mark complete"}
          </button>
        )}
      </div>

      {lesson.description && (
        <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-foreground/90">
          {lesson.description}
        </p>
      )}

      {lesson.is_premium && !isGold && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold">This is a Gold lesson</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upgrade to unlock premium content, personal repertoire, and the AI coach.
          </p>
          <Link
            to="/billing"
            className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Upgrade to Gold
          </Link>
        </div>
      )}
    </div>
  );
}
