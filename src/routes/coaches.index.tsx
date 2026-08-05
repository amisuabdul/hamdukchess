import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Search, Sparkles, GraduationCap } from "lucide-react";
import { listCoaches, type CoachCard } from "@/lib/coaching.functions";
import { COACH_LANGUAGES, COACH_SPECIALTIES, nairaFromKobo } from "@/lib/coaching-data";

export const Route = createFileRoute("/coaches/")({
  head: () => ({
    meta: [
      { title: "Chess Coach Marketplace — Hamduk Chess" },
      {
        name: "description",
        content:
          "Browse titled chess coaches, filter by language, specialty, price and rating, and book a one-on-one session.",
      },
      { property: "og:title", content: "Chess Coach Marketplace — Hamduk Chess" },
      {
        property: "og:description",
        content: "Find and book a chess coach — filter by language, specialty, price and rating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoachesIndex,
});

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

function CoachesIndex() {
  const fetchCoaches = useServerFn(listCoaches);
  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => fetchCoaches() as Promise<CoachCard[]>,
  });

  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [maxRate, setMaxRate] = useState(0);
  const [minRating, setMinRating] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return coaches.filter((c) => {
      if (needle && !`${c.display_name} ${c.bio ?? ""} ${c.specialties.join(" ")}`.toLowerCase().includes(needle))
        return false;
      if (language !== "all" && !c.languages.includes(language)) return false;
      if (specialty !== "all" && !c.specialties.includes(specialty)) return false;
      if (maxRate > 0 && c.hourly_rate_kobo > maxRate * 100) return false;
      if (minRating > 0 && c.avg_rating < minRating) return false;
      return true;
    });
  }, [coaches, q, language, specialty, maxRate, minRating]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Gold feature
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">Coach Marketplace</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Work one-on-one with titled coaches. Filter by language, specialty, price and rating, then book a slot that
          fits your week.
        </p>
        <Link
          to="/coaching/dashboard"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <GraduationCap className="h-4 w-4" />
          Coach dashboard
        </Link>
      </header>

      <div className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coaches"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
            aria-label="Search coaches"
          />
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Language"
        >
          <option value="all">Any language</option>
          {COACH_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-label="Specialty"
        >
          <option value="all">Any specialty</option>
          {COACH_SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={maxRate || ""}
            onChange={(e) => setMaxRate(Number(e.target.value) || 0)}
            placeholder="Max ₦/hr"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Maximum hourly rate in naira"
          />
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            aria-label="Minimum rating"
          >
            <option value={0}>★ any</option>
            <option value={3}>3+</option>
            <option value={4}>4+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading coaches…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No coaches match these filters yet. Are you a titled player? Set up your profile from the coach dashboard.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md">
              <Link to="/coaches/$coachId" params={{ coachId: c.id }} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg font-semibold leading-tight">
                      {c.fide_title && c.fide_title !== "None" && (
                        <span className="mr-1.5 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">
                          {c.fide_title}
                        </span>
                      )}
                      {c.display_name}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.fide_elo ? `${c.fide_elo} FIDE · ` : ""}
                      {c.sessions_completed} sessions
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-primary">
                    {nairaFromKobo(c.hourly_rate_kobo)}/hr
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars rating={c.avg_rating} />
                  {c.rating_count > 0 ? `${c.avg_rating} (${c.rating_count})` : "New coach"}
                </div>

                {c.bio && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.bio}</p>}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.specialties.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent">
                      {s}
                    </span>
                  ))}
                  {c.languages.slice(0, 2).map((l) => (
                    <span key={l} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                      {l}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
