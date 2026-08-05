import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Star, CheckCircle2 } from "lucide-react";
import {
  getMyCoachProfile,
  upsertCoachProfile,
  setCoachAvailability,
  getMyCoachSessions,
  saveSessionNotes,
  completeCoachSession,
  submitCoachReview,
} from "@/lib/coaching.functions";
import {
  COACH_LANGUAGES,
  COACH_SPECIALTIES,
  FIDE_TITLES,
  WEEKDAYS,
  minuteToLabel,
  nairaFromKobo,
} from "@/lib/coaching-data";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/coaching/dashboard")({
  head: () => ({
    meta: [
      { title: "Coaching Dashboard — Hamduk Chess" },
      {
        name: "description",
        content:
          "Manage your coaching profile, weekly availability, booked sessions, shared session notes and student reviews.",
      },
      { property: "og:title", content: "Coaching Dashboard — Hamduk Chess" },
      {
        property: "og:description",
        content: "Manage your coaching profile, availability, sessions and notes on Hamduk Chess.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachingDashboard;
});

type SlotDraft = { weekday: number; start_minute: number; end_minute: number };

function CoachingDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyCoachProfile);
  const fetchSessions = useServerFn(getMyCoachSessions);
  const saveProfile = useServerFn(upsertCoachProfile);
  const saveSlots = useServerFn(setCoachAvailability);
  const saveNotes = useServerFn(saveSessionNotes);
  const complete = useServerFn(completeCoachSession);
  const review = useServerFn(submitCoachReview);

  const { data: mine, isLoading } = useQuery({
    queryKey: ["my-coach-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const { data: sessions } = useQuery({
    queryKey: ["my-coach-sessions"],
    queryFn: () => fetchSessions(),
    enabled: !!user,
  });

  const [form, setForm] = useState({
    display_name: "",
    fide_title: "None",
    fide_elo: "",
    hourly_rate_naira: "5000",
    languages: ["English"] as string[],
    specialties: [] as string[],
    bio: "",
    timezone: "Africa/Lagos",
    paystack_subaccount_code: "",
    is_active: false,
  });
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mine) return;
    const p = mine.profile as Record<string, unknown>;
    setForm({
      display_name: String(p.display_name ?? ""),
      fide_title: (p.fide_title as string) ?? "None",
      fide_elo: p.fide_elo ? String(p.fide_elo) : "",
      hourly_rate_naira: String(Math.round(Number(p.hourly_rate_kobo ?? 500000) / 100)),
      languages: (p.languages as string[]) ?? [],
      specialties: (p.specialties as string[]) ?? [],
      bio: (p.bio as string) ?? "",
      timezone: String(p.timezone ?? "Africa/Lagos"),
      paystack_subaccount_code: (p.paystack_subaccount_code as string) ?? "",
      is_active: Boolean(p.is_active),
    });
    setSlots(mine.availability.map((a) => ({ weekday: a.weekday, start_minute: a.start_minute, end_minute: a.end_minute })));
  }, [mine]);

  function toggle(list: string[], value: string) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveProfile({
        data: {
          display_name: form.display_name,
          fide_title: form.fide_title === "None" ? null : form.fide_title,
          fide_elo: form.fide_elo ? Number(form.fide_elo) : null,
          hourly_rate_kobo: Math.max(500, Number(form.hourly_rate_naira) || 0) * 100,
          languages: form.languages,
          specialties: form.specialties,
          bio: form.bio || null,
          timezone: form.timezone,
          paystack_subaccount_code: form.paystack_subaccount_code || null,
          is_active: form.is_active,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const slotRes = await saveSlots({ data: { slots } });
      if (!slotRes.ok) toast.error(slotRes.error);
      else toast.success("Coaching profile saved.");
      qc.invalidateQueries({ queryKey: ["my-coach-profile"] });
      qc.invalidateQueries({ queryKey: ["coaches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!user)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold">Coaching dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your coaching profile and sessions.</p>
        <Link to="/login" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Sign in
        </Link>
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Coaching dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set up your coaching profile (Gold required), publish availability, and manage sessions.
      </p>

      {/* Sessions */}
      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">My sessions as a student</h2>
        {!sessions || sessions.asStudent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sessions yet.{" "}
            <Link to="/coaches" className="text-primary underline">
              Browse coaches
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sessions.asStudent.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(s.scheduled_at).toLocaleString()} · {s.duration_min} min
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nairaFromKobo(s.amount_kobo)} · {s.status.replace("_", " ")}
                    </p>
                  </div>
                  {s.status === "completed" && !sessions.reviewedSessionIds.includes(s.id) && (
                    <ReviewForm
                      onSubmit={async (rating, comment) => {
                        const res = await review({ data: { session_id: s.id, rating, comment } });
                        if (res.ok) {
                          toast.success("Thanks for the review!");
                          qc.invalidateQueries({ queryKey: ["my-coach-sessions"] });
                        } else toast.error(res.error);
                      }}
                    />
                  )}
                </div>
                <NotesBox
                  label="Your notes (shared with your coach)"
                  initial={s.student_notes ?? ""}
                  onSave={async (notes) => {
                    const res = await saveNotes({ data: { session_id: s.id, notes } });
                    if (res.ok) toast.success("Notes saved.");
                    else toast.error(res.error);
                  }}
                />
                {s.coach_notes && (
                  <div className="mt-2 rounded-md bg-secondary/60 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Coach notes</p>
                    <p className="mt-1 whitespace-pre-line">{s.coach_notes}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sessions && sessions.asCoach.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Sessions I'm coaching</h2>
          <ul className="mt-3 space-y-3">
            {sessions.asCoach.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {new Date(s.scheduled_at).toLocaleString()} · {s.duration_min} min
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nairaFromKobo(s.amount_kobo)} · fee {nairaFromKobo(s.platform_fee_kobo)} · {s.status.replace("_", " ")}
                    </p>
                  </div>
                  {s.status === "confirmed" && (
                    <button
                      onClick={async () => {
                        const res = await complete({ data: { session_id: s.id } });
                        if (res.ok) {
                          toast.success("Session marked complete.");
                          qc.invalidateQueries({ queryKey: ["my-coach-sessions"] });
                        } else toast.error(res.error);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
                    </button>
                  )}
                </div>
                <NotesBox
                  label="Session notes (shared with your student)"
                  initial={s.coach_notes ?? ""}
                  onSave={async (notes) => {
                    const res = await saveNotes({ data: { session_id: s.id, notes } });
                    if (res.ok) toast.success("Notes saved.");
                    else toast.error(res.error);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Coach profile editor */}
      <section className="mt-10 rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-xl font-semibold">Become a coach</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gold subscription required. Add your Paystack subaccount code to receive payouts automatically.
        </p>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Display name
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              FIDE title
              <select
                value={form.fide_title}
                onChange={(e) => setForm({ ...form, fide_title: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {FIDE_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              FIDE rating
              <input
                type="number"
                value={form.fide_elo}
                onChange={(e) => setForm({ ...form, fide_elo: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              Hourly rate (₦)
              <input
                type="number"
                value={form.hourly_rate_naira}
                onChange={(e) => setForm({ ...form, hourly_rate_naira: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Bio
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="text-sm sm:col-span-2">
              Languages
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {COACH_LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => setForm({ ...form, languages: toggle(form.languages, l) })}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      form.languages.includes(l) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-sm sm:col-span-2">
              Specialties
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {COACH_SPECIALTIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, specialties: toggle(form.specialties, s) })}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      form.specialties.includes(s) ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-sm">
              Paystack subaccount code
              <input
                value={form.paystack_subaccount_code}
                onChange={(e) => setForm({ ...form, paystack_subaccount_code: e.target.value })}
                placeholder="ACCT_xxxxxxxx"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Listed in the marketplace
            </label>

            {/* Availability editor */}
            <div className="text-sm sm:col-span-2">
              <p className="font-medium">Weekly availability</p>
              <ul className="mt-2 space-y-2">
                {slots.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={s.weekday}
                      onChange={(e) =>
                        setSlots(slots.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    >
                      {WEEKDAYS.map((d, wi) => (
                        <option key={d} value={wi}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={`${String(Math.floor(s.start_minute / 60)).padStart(2, "0")}:${String(s.start_minute % 60).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        setSlots(slots.map((x, j) => (j === i ? { ...x, start_minute: h * 60 + m } : x)));
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="time"
                      value={`${String(Math.floor(s.end_minute / 60)).padStart(2, "0")}:${String(s.end_minute % 60).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        setSlots(slots.map((x, j) => (j === i ? { ...x, end_minute: h * 60 + m } : x)));
                      }}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {minuteToLabel(s.start_minute)} – {minuteToLabel(s.end_minute)}
                    </span>
                    <button
                      onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                      className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setSlots([...slots, { weekday: 1, start_minute: 17 * 60, end_minute: 20 * 60 }])}
                className="mt-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                Add slot
              </button>
            </div>

            <div className="sm:col-span-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save coaching profile
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function NotesBox({
  label,
  initial,
  onSave,
}: {
  label: string;
  initial: string;
  onSave: (notes: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3">
      <label className="text-xs font-semibold uppercase text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        onClick={async () => {
          setBusy(true);
          await onSave(value);
          setBusy(false);
        }}
        disabled={busy}
        className="mt-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save notes"}
      </button>
    </div>
  );
}

function ReviewForm({ onSubmit }: { onSubmit: (rating: number, comment: string) => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
            <Star className={`h-4 w-4 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment"
        className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
      />
      <button
        onClick={async () => {
          setBusy(true);
          await onSubmit(rating, comment);
          setBusy(false);
        }}
        disabled={busy}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        Submit review
      </button>
    </div>
  );
}
