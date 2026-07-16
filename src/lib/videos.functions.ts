import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VideoLesson = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  source: "youtube" | "vimeo" | "cloud";
  external_id: string | null;
  storage_path: string | null;
  duration_sec: number;
  thumbnail_url: string | null;
  instructor: string | null;
  is_premium: boolean;
  sort_order: number;
};

export type VideoProgress = {
  video_id: string;
  position_sec: number;
  completed: boolean;
  last_watched_at: string;
};

/** Public — list all published lessons (safe columns only). */
export const listVideoLessons = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const url = process.env.SUPABASE_URL;
  if (!key || !url) throw new Error("Supabase env not configured");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client
    .from("video_lessons")
    .select(
      "id,title,description,category,difficulty,source,external_id,storage_path,duration_sec,thumbnail_url,instructor,is_premium,sort_order",
    )
    .eq("published", true)
    .order("category")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as VideoLesson[];
});

export const getMyVideoProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_video_progress")
      .select("video_id,position_sec,completed,last_watched_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []) as VideoProgress[];
  });

const RecordSchema = z.object({
  videoId: z.string().uuid(),
  positionSec: z.number().int().min(0).max(86400),
  completed: z.boolean(),
});

export const recordVideoProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RecordSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_video_progress").upsert(
      {
        user_id: userId,
        video_id: data.videoId,
        position_sec: data.positionSec,
        completed: data.completed,
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,video_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SignedUrlSchema = z.object({ videoId: z.string().uuid() });

/**
 * Mints a short-lived signed URL for a cloud-hosted lesson.
 * Enforces Gold-tier gating for `is_premium=true` lessons.
 */
export const getSignedVideoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SignedUrlSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: lesson, error } = await supabase
      .from("video_lessons")
      .select("source,storage_path,is_premium,published")
      .eq("id", data.videoId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lesson || !lesson.published) throw new Error("Lesson not found");
    if (lesson.source !== "cloud" || !lesson.storage_path) {
      throw new Error("This lesson is not hosted on Lovable Cloud");
    }
    if (lesson.is_premium) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.subscription_tier !== "gold") {
        throw new Error("This lesson is available on the Gold plan");
      }
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from("lesson-videos")
      .createSignedUrl(lesson.storage_path, 60 * 60);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl };
  });
