import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVideoLessons, getMyVideoProgress, type VideoLesson, type VideoProgress } from "@/lib/videos.functions";
import { useAuth } from "@/lib/auth";
import { PlayCircle, Check, Lock, Clock } from "lucide-react";

export const Route = createFileRoute("/lessons/")({
  head: () => ({
    meta: [
      { title: "Video Lessons — Hamduk Chess" },
      {
        name: "description",
        content:
          "Watch curated chess lessons — openings, tactics, endgames, strategy — from top coaches and titled players.",
      },
      { property: "og:title", content: "Video Lessons — Hamduk Chess" },
      { property: "og:description", content: "Learn chess from curated video lessons across every phase of the game." },
    ],
  }),
  component: LessonsIndex,
});

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function LessonsIndex() {
  const { user } = useAuth();
  const fetchLessons = useServerFn(listVideoLessons);
  const fetchProgress = useServerFn(getMyVideoProgress);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["video-lessons"],
    queryFn: () => fetchLessons() as Promise<VideoLesson[]>,
  });
  const { data: progress = [] } = useQuery({
    queryKey: ["my-video-progress"],
    queryFn: () => fetchProgress() as Promise<VideoProgress[]>,
    enabled: !!user,
  });

  const progressById = useMemo(() => {
    const m = new Map<string, VideoProgress>();
    for (const p of progress) m.set(p.video_id, p);
    return m;
  }, [progress]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const l of lessons) {
      if (!seen.has(l.category)) {
        seen.add(l.category);
        list.push(l.category);
      }
    }
    return list;
  }, [lessons]);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");

  const filtered = useMemo(() => {
    return lessons.filter(
      (l) => (!activeCat || l.category === activeCat) && (difficulty === "all" || l.difficulty === difficulty),
    );
  }, [lessons, activeCat, difficulty]);

  const grouped = useMemo(() => {
    const map = new Map<string, VideoLesson[]>();
    for (const l of filtered) {
      const arr = map.get(l.category) ?? [];
      arr.push(l);
      map.set(l.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-8">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Video Lessons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Learn from curated lessons across openings, tactics, endgames, and strategy.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCat(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
            activeCat === null
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-card text-muted-foreground ring-border hover:text-foreground"
          }`}
        >
          All categories
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              activeCat === c
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-card text-muted-foreground ring-border hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
        <span className="mx-2 h-4 w-px bg-border" />
        {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDifficulty(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              difficulty === d
                ? "bg-accent text-accent-foreground ring-accent"
                : "bg-card text-muted-foreground ring-border hover:text-foreground"
            }`}
          >
            {d === "all" ? "All levels" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading lessons…</p>}

      {!isLoading && grouped.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No lessons match those filters.
        </p>
      )}

      <div className="space-y-8">
        {grouped.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-3 font-serif text-xl font-semibold">{cat}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l) => {
                const p = progressById.get(l.id);
                return (
                  <Link
                    key={l.id}
                    to="/lessons/$id"
                    params={{ id: l.id }}
                    className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-video bg-muted">
                      {l.thumbnail_url ? (
                        <img
                          src={l.thumbnail_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <PlayCircle className="h-10 w-10" />
                        </div>
                      )}
                      {l.is_premium && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                          <Lock className="h-3 w-3" /> Gold
                        </span>
                      )}
                      {p?.completed && (
                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                          <Check className="h-3 w-3" /> Done
                        </span>
                      )}
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        <Clock className="h-3 w-3" />
                        {formatDuration(l.duration_sec)}
                      </span>
                    </div>
                    <div className="p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{l.title}</h3>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{l.instructor ?? "—"}</span>
                        <span className="capitalize">{l.difficulty}</span>
                      </div>
                      {p && !p.completed && p.position_sec > 5 && l.duration_sec > 0 && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(100, (p.position_sec / l.duration_sec) * 100).toFixed(0)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
