import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient, initSessionCheckout, verifyPaystackReference } from "@/lib/coaching.server";
import { sessionPriceKobo } from "@/lib/coaching-data";
import {
  AvailabilityInput,
  BookSessionInput,
  CoachIdInput,
  CoachProfileInput,
  NotesInput,
  ReferenceInput,
  ReviewInput,
  SessionIdInput,
} from "@/lib/coaching-schemas";

export type CoachCard = {
  id: string;
  display_name: string;
  fide_title: string | null;
  fide_elo: number | null;
  hourly_rate_kobo: number;
  currency: string;
  languages: string[];
  specialties: string[];
  bio: string | null;
  timezone: string;
  avg_rating: number;
  rating_count: number;
  sessions_completed: number;
};

export type CoachAvailabilitySlot = {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
};

export type CoachReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type CoachSession = {
  id: string;
  coach_id: string;
  student_id: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  amount_kobo: number;
  platform_fee_kobo: number;
  currency: string;
  meeting_url: string | null;
  coach_notes: string | null;
  student_notes: string | null;
  created_at: string;
};

const COACH_CARD_COLUMNS =
  "id,display_name,fide_title,fide_elo,hourly_rate_kobo,currency,languages,specialties,bio,timezone,avg_rating,rating_count,sessions_completed";

/** Public — browse active coaches. */
export const listCoaches = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("coach_profiles")
    .select(COACH_CARD_COLUMNS)
    .eq("is_active", true)
    .order("avg_rating", { ascending: false })
    .order("sessions_completed", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as CoachCard[];
});

/** Public — one coach with availability + reviews. */
export const getCoach = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => CoachIdInput.parse(input))
  .handler(async ({ data }) => {
    const client = publicClient();
    const [{ data: coach, error }, { data: slots }, { data: reviews }] = await Promise.all([
      client.from("coach_profiles").select(COACH_CARD_COLUMNS).eq("id", data.coach_id).maybeSingle(),
      client
        .from("coach_availability")
        .select("id,weekday,start_minute,end_minute")
        .eq("coach_id", data.coach_id)
        .order("weekday")
        .order("start_minute"),
      client
        .from("coach_reviews")
        .select("id,rating,comment,created_at")
        .eq("coach_id", data.coach_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (error) throw new Error(error.message);
    if (!coach) return null;
    return {
      coach: coach as CoachCard,
      availability: (slots ?? []) as CoachAvailabilitySlot[],
      reviews: (reviews ?? []) as CoachReview[],
    };
  });

export const getMyCoachProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("coach_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    const { data: slots } = await context.supabase
      .from("coach_availability")
      .select("id,weekday,start_minute,end_minute")
      .eq("coach_id", data.id)
      .order("weekday")
      .order("start_minute");
    return { profile: data, availability: (slots ?? []) as CoachAvailabilitySlot[] };
  });

/** Gold-only: create or update your coaching profile. */
export const upsertCoachProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CoachProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.subscription_tier !== "gold") {
      return { ok: false as const, error: "Coach accounts require a Gold subscription." };
    }

    const payload = {
      user_id: userId,
      display_name: data.display_name,
      fide_title: data.fide_title ?? null,
      fide_elo: data.fide_elo ?? null,
      hourly_rate_kobo: data.hourly_rate_kobo,
      languages: data.languages,
      specialties: data.specialties,
      bio: data.bio ?? null,
      timezone: data.timezone,
      paystack_subaccount_code: data.paystack_subaccount_code ?? null,
      is_active: data.is_active,
    };
    const { data: row, error } = await supabase
      .from("coach_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, coach_id: row.id };
  });

/** Replace the caller's weekly availability. */
export const setCoachAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AvailabilityInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: coach } = await supabase
      .from("coach_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!coach) return { ok: false as const, error: "Create your coaching profile first." };

    const clean = data.slots.filter((s) => s.end_minute > s.start_minute);
    await supabase.from("coach_availability").delete().eq("coach_id", coach.id);
    if (clean.length > 0) {
      const { error } = await supabase
        .from("coach_availability")
        .insert(clean.map((s) => ({ ...s, coach_id: coach.id })));
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const, count: clean.length };
  });

/** Gold-only: book a session and get a Paystack checkout URL. */
export const bookCoachSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BookSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: me } = await supabase
      .from("profiles")
      .select("username, subscription_tier")
      .eq("id", userId)
      .maybeSingle();
    if (me?.subscription_tier !== "gold") {
      return { ok: false as const, error: "Booking a coach requires a Gold subscription." };
    }

    const start = new Date(data.scheduled_at);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 60 * 60 * 1000) {
      return { ok: false as const, error: "Pick a slot at least 1 hour from now." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: coach } = await supabaseAdmin
      .from("coach_profiles")
      .select("id,user_id,hourly_rate_kobo,platform_fee_pct,paystack_subaccount_code,is_active,timezone")
      .eq("id", data.coach_id)
      .maybeSingle();
    if (!coach || !coach.is_active) return { ok: false as const, error: "Coach is not available." };
    if (coach.user_id === userId) return { ok: false as const, error: "You cannot book yourself." };

    // Availability check (coach-local weekday/minute derived in the coach's timezone).
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: coach.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(start);
    const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wdName);
    const startMin = (hour % 24) * 60 + minute;
    const endMin = startMin + data.duration_min;

    const { data: slots } = await supabaseAdmin
      .from("coach_availability")
      .select("weekday,start_minute,end_minute")
      .eq("coach_id", coach.id);
    const fits = (slots ?? []).some(
      (s) => s.weekday === weekday && startMin >= s.start_minute && endMin <= s.end_minute,
    );
    if (!fits) return { ok: false as const, error: "That time is outside the coach's availability." };

    // Overlap check against existing live sessions.
    const dayStart = new Date(start.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const dayEnd = new Date(start.getTime() + 6 * 60 * 60 * 1000).toISOString();
    const { data: nearby } = await supabaseAdmin
      .from("coach_sessions")
      .select("scheduled_at,duration_min,status")
      .eq("coach_id", coach.id)
      .in("status", ["pending_payment", "confirmed"])
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);
    const endMs = start.getTime() + data.duration_min * 60_000;
    const clash = (nearby ?? []).some((s) => {
      const sStart = new Date(s.scheduled_at).getTime();
      const sEnd = sStart + s.duration_min * 60_000;
      return start.getTime() < sEnd && sStart < endMs;
    });
    if (clash) return { ok: false as const, error: "That slot is already booked." };

    const amount = sessionPriceKobo(coach.hourly_rate_kobo, data.duration_min);
    const fee = Math.round((amount * coach.platform_fee_pct) / 100);
    const reference = `hc_coach_${data.coach_id.slice(0, 8)}_${Date.now()}`;

    const { data: session, error: insertErr } = await supabaseAdmin
      .from("coach_sessions")
      .insert({
        coach_id: coach.id,
        student_id: userId,
        scheduled_at: start.toISOString(),
        duration_min: data.duration_min,
        amount_kobo: amount,
        platform_fee_kobo: fee,
        paystack_reference: reference,
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (insertErr || !session) return { ok: false as const, error: insertErr?.message ?? "Could not create session" };

    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email ?? `${me?.username ?? "student"}+guest@hamdukchess.local`;

    try {
      const checkout = await initSessionCheckout({
        email,
        amountKobo: amount,
        platformFeeKobo: fee,
        reference,
        callbackUrl: data.callback_url,
        subaccountCode: coach.paystack_subaccount_code,
        metadata: {
          kind: "coach_session",
          session_id: session.id,
          coach_id: coach.id,
          user_id: userId,
        },
      });
      await supabaseAdmin.from("payment_events").insert({
        user_id: userId,
        event: "coach_session.initialized",
        reference,
        amount,
        currency: "NGN",
        plan_code: "coach_session",
        raw: { session_id: session.id, coach_id: coach.id },
      });
      return { ok: true as const, authorization_url: checkout.authorization_url, reference, session_id: session.id };
    } catch (e) {
      await supabaseAdmin.from("coach_sessions").update({ status: "cancelled" }).eq("id", session.id);
      return { ok: false as const, error: e instanceof Error ? e.message : "Checkout failed" };
    }
  });

/** Confirm a session after returning from Paystack. */
export const verifyCoachSessionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReferenceInput.parse(input))
  .handler(async ({ data, context }) => {
    const tx = await verifyPaystackReference(data.reference);
    if (!tx) return { ok: false as const, status: "failed" };
    const meta = (tx.metadata ?? {}) as { kind?: string; session_id?: string; user_id?: string };
    if (meta.kind !== "coach_session" || !meta.session_id || meta.user_id !== context.userId) {
      return { ok: false as const, status: "mismatch" };
    }
    if (tx.status !== "success") return { ok: false as const, status: tx.status };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("coach_sessions")
      .update({ status: "confirmed" })
      .eq("id", meta.session_id)
      .eq("student_id", context.userId);
    return { ok: true as const, status: "confirmed", session_id: meta.session_id };
  });

export const getMyCoachSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: coach } = await supabase
      .from("coach_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: asStudent } = await supabase
      .from("coach_sessions")
      .select("*")
      .eq("student_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(100);

    let asCoach: CoachSession[] = [];
    if (coach) {
      const { data } = await supabase
        .from("coach_sessions")
        .select("*")
        .eq("coach_id", coach.id)
        .order("scheduled_at", { ascending: false })
        .limit(100);
      asCoach = (data ?? []) as CoachSession[];
    }

    const { data: myReviews } = await supabase
      .from("coach_reviews")
      .select("session_id,rating,comment")
      .eq("student_id", userId);

    return {
      asStudent: (asStudent ?? []) as CoachSession[],
      asCoach,
      reviewedSessionIds: (myReviews ?? []).map((r) => r.session_id),
    };
  });

/** Notes are shared: coach writes coach_notes, student writes student_notes. */
export const saveSessionNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NotesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("coach_sessions")
      .select("id,student_id,coach_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!session) return { ok: false as const, error: "Session not found" };

    const isStudent = session.student_id === userId;
    const { error } = await supabase
      .from("coach_sessions")
      .update(isStudent ? { student_notes: data.notes } : { coach_notes: data.notes })
      .eq("id", data.session_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Coach marks a confirmed session complete. */
export const completeCoachSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SessionIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: coach } = await supabase
      .from("coach_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!coach) return { ok: false as const, error: "Not a coach" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: session } = await supabaseAdmin
      .from("coach_sessions")
      .select("id,status,coach_id")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!session || session.coach_id !== coach.id) return { ok: false as const, error: "Session not found" };
    if (session.status !== "confirmed") return { ok: false as const, error: "Only confirmed sessions can be completed." };

    await supabaseAdmin.from("coach_sessions").update({ status: "completed" }).eq("id", session.id);
    const { data: countRow } = await supabaseAdmin
      .from("coach_sessions")
      .select("id")
      .eq("coach_id", coach.id)
      .eq("status", "completed");
    await supabaseAdmin
      .from("coach_profiles")
      .update({ sessions_completed: (countRow ?? []).length })
      .eq("id", coach.id);
    return { ok: true as const };
  });

/** Student leaves a 1–5 star review on a completed session. */
export const submitCoachReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("coach_sessions")
      .select("id,coach_id,student_id,status")
      .eq("id", data.session_id)
      .maybeSingle();
    if (!session || session.student_id !== userId) return { ok: false as const, error: "Session not found" };
    if (session.status !== "completed") return { ok: false as const, error: "You can review after the session is completed." };

    const { error } = await supabase.from("coach_reviews").upsert(
      {
        session_id: session.id,
        coach_id: session.coach_id,
        student_id: userId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
      { onConflict: "session_id" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
