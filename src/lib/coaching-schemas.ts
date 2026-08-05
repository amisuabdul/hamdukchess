import { z } from "zod";

export const CoachProfileInput = z.object({
  display_name: z.string().min(2).max(60),
  fide_title: z.string().max(10).nullable().optional(),
  fide_elo: z.number().int().min(0).max(3000).nullable().optional(),
  hourly_rate_kobo: z.number().int().min(50_000).max(50_000_000),
  languages: z.array(z.string().max(30)).max(10),
  specialties: z.array(z.string().max(40)).max(10),
  bio: z.string().max(1200).nullable().optional(),
  timezone: z.string().max(60).default("Africa/Lagos"),
  paystack_subaccount_code: z.string().max(60).nullable().optional(),
  is_active: z.boolean(),
});

export const AvailabilityInput = z.object({
  slots: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start_minute: z.number().int().min(0).max(1439),
        end_minute: z.number().int().min(1).max(1440),
      }),
    )
    .max(40),
});

export const BookSessionInput = z.object({
  coach_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  duration_min: z.number().int().min(15).max(240),
  callback_url: z.string().url().max(500),
});

export const CoachIdInput = z.object({ coach_id: z.string().uuid() });
export const ReferenceInput = z.object({ reference: z.string().min(1).max(200) });
export const SessionIdInput = z.object({ session_id: z.string().uuid() });
export const NotesInput = z.object({
  session_id: z.string().uuid(),
  notes: z.string().max(4000),
});
export const ReviewInput = z.object({
  session_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
