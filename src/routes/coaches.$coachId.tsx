import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import {
  getCoach,
  bookCoachSession,
  verifyCoachSessionPayment,
} from "@/lib/coaching.functions";
import {
  SESSION_DURATIONS,
  WEEKDAYS,
  minuteToLabel,
  nairaFromKobo,
  sessionPriceKobo,
} from "@/lib/coaching-data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/coaches/$coachId")({
  head: () => ({
    meta: [
      { title: "Coach Profile — Hamduk Chess" },
      {
        name: "description",
        content: "See a coach's title, rating, specialties, availability and student reviews, then book a session.",
      },
      { property: "og:title", content: "Coach Profile — Hamduk Chess" },
      {
        property: "og:description",
        content: "Coach title, rating, specialties, availability and reviews — book a one-on-one chess session.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachDetail,
});

/** Next 14 days of concrete slots derived from the coach's weekly availability. */
function buildSlots(
  availability: { weekday: number; start_minute: number; end_minute: number }[],
  durationMin: number,
) {
  const out: { iso: string; label: string; day: string }[] = [];
  const now = Date.now();
  for (let d = 0; d < 14; d++) {
    const base = new Date();
    base.setDate(base.getDate() + d);
    const weekday = base.getDay();
    for (const slot of availability.filter((a) => a.weekday === weekday)) {
      for (let m = slot.start_minute; m + durationMin <= slot.end_minute; m += 30) {
        const dt = new Date(base);
        dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
        if (dt.getTime() < now + 60 * 60 * 1000) continue;
        out.push({
          iso: dt.toISOString(),
          label: minuteToLabel(m),
          day: dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        });
      }
    }
  }
  return out;
}

function CoachDetail() {
  const { coachId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchCoach = useServerFn(getCoach);
  const book = useServerFn(bookCoachSession);
  const verify = useServerFn(verifyCoachSessionPayment);

  const { data, isLoading } = useQuery({
    queryKey: ["coach", coachId],
    queryFn: () => fetchCoach({ data: { coach_id: coachId } }),
  });

  const [duration, setDuration] = useState<number>(60);
  const [slotIso, setSlotIso] = useState("");
  const [booking, setBooking] = useState(false);

  // Handle the Paystack callback (?reference=…)
  useEffect(() => {
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    if (!reference || !user) return;
    verify({ data: { reference } }).then((res) => {
      if (res.ok) {
        toast.success("Session booked and paid — see it in your dashboard.");
        navigate({ to: "/coaching/dashboard" });
      } else {
        toast.error("We could not confirm that payment.");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const slots = useMemo(() => buildSlots(data?.availability ?? [], duration), [data?.availability, duration]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof slots>();
    for (const s of slots) {
      const arr = map.get(s.day) ?? [];
      arr.push(s);
      map.set(s.day, arr);
    }
    return [...map.entries()].slice(0, 7);
  }, [slots]);

  if (isLoading) return <main className="p-8 text-sm text-muted-foreground">Loading coach…</main>;
  if (!data)
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">This coach profile is not available.</p>
        <Link to="/coaches" className="mt-3 inline-block text-sm text-primary underline">
          Back to marketplace
        </Link>
      </main>
    );

  const { coach, availability, reviews } = data;
  const price = sessionPriceKobo(coach.hourly_rate_kobo, duration);

  async function onBook() {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!slotIso) {
      toast.error("Pick a time slot first.");
      return;
    }
    setBooking(true);
    try {
      const res = await book({
        data: {
          coach_id: coachId,
          scheduled_at: slotIso,
          duration_min: duration,
          callback_url: `${window.location.origin}/coaches/${coachId}`,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.authorization_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBooking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link to="/coaches" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All coaches
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            {coach.fide_title && coach.fide_title !== "None" && (
              <span className="mr-2 rounded bg-primary/15 px-2 py-0.5 text-base font-bold text-primary">
                {coach.fide_title}
              </span>
            )}
            {coach.display_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {coach.fide_elo ? `${coach.fide_elo} FIDE · ` : ""}
            {coach.sessions_completed} sessions completed · {coach.timezone}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${n <= Math.round(coach.avg_rating) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                />
              ))}
            </span>
            <span className="text-muted-foreground">
              {coach.rating_count > 0 ? `${coach.avg_rating} from ${coach.rating_count} reviews` : "No reviews yet"}
            </span>
          </div>

          {coach.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{coach.bio}</p>}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {coach.specialties.map((s) => (
              <span key={s} className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent">
                {s}
              </span>
            ))}
            {coach.languages.map((l) => (
              <span key={l} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                {l}
              </span>
            ))}
          </div>

          <h2 className="mt-8 font-serif text-xl font-semibold">Weekly availability</h2>
          {availability.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">This coach has not published availability yet.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
              {availability.map((a) => (
                <li key={a.id} className="rounded-md border border-border px-3 py-1.5">
                  <span className="font-medium">{WEEKDAYS[a.weekday]}</span>{" "}
                  <span className="text-muted-foreground">
                    {minuteToLabel(a.start_minute)} – {minuteToLabel(a.end_minute)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-serif text-xl font-semibold">Student reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-6">
          <h2 className="font-serif text-lg font-semibold">Book a session</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {nairaFromKobo(coach.hourly_rate_kobo)} per hour · Gold members only
          </p>

          <div className="mt-4">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Duration</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SESSION_DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDuration(d);
                    setSlotIso("");
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    duration === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Next available</span>
            {grouped.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">No open slots in the next 7 days.</p>
            ) : (
              <div className="mt-1.5 max-h-64 space-y-3 overflow-y-auto pr-1">
                {grouped.map(([day, list]) => (
                  <div key={day}>
                    <p className="text-xs font-medium text-muted-foreground">{day}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {list.map((s) => (
                        <button
                          key={s.iso}
                          onClick={() => setSlotIso(s.iso)}
                          className={`rounded-md px-2.5 py-1 text-xs ${
                            slotIso === s.iso
                              ? "bg-primary text-primary-foreground"
                              : "border border-border hover:bg-accent"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{nairaFromKobo(price)}</span>
          </div>

          <button
            onClick={onBook}
            disabled={booking || !slotIso}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            Pay & book
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Secure payment via Paystack. Your coach receives their share automatically.
          </p>
        </aside>
      </div>
    </main>
  );
}
