import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSignedVideoUrl, recordVideoProgress } from "@/lib/videos.functions";
import { Lock } from "lucide-react";

type Props = {
  videoId: string;
  source: "youtube" | "vimeo" | "cloud";
  externalId: string | null;
  isPremium: boolean;
  canWatchPremium: boolean;
  initialPosition: number;
  authed: boolean;
  onProgress?: (positionSec: number, completed: boolean) => void;
};

/** Renders the correct player for youtube, vimeo, or Lovable-hosted (cloud) sources. */
export function VideoPlayer({
  videoId,
  source,
  externalId,
  isPremium,
  canWatchPremium,
  initialPosition,
  authed,
  onProgress,
}: Props) {
  const record = useServerFn(recordVideoProgress);
  const signUrl = useServerFn(getSignedVideoUrl);
  const [cloudUrl, setCloudUrl] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSaveRef = useRef(0);

  useEffect(() => {
    if (source !== "cloud" || !authed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await signUrl({ data: { videoId } });
        if (!cancelled) setCloudUrl(res.url);
      } catch (e) {
        if (!cancelled) setCloudError(e instanceof Error ? e.message : "Failed to load video");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, authed, videoId, signUrl]);

  // Auto-save cloud playback position every 10s
  useEffect(() => {
    if (source !== "cloud" || !authed || !cloudUrl) return;
    const el = videoRef.current;
    if (!el) return;
    if (initialPosition > 0 && initialPosition < el.duration) {
      el.currentTime = initialPosition;
    }
    const onTime = () => {
      const now = Date.now();
      if (now - lastSaveRef.current < 10_000) return;
      lastSaveRef.current = now;
      const pos = Math.floor(el.currentTime);
      const done = el.duration > 0 && el.currentTime / el.duration >= 0.9;
      record({ data: { videoId, positionSec: pos, completed: done } }).catch(() => {});
      onProgress?.(pos, done);
    };
    const onEnded = () => {
      const pos = Math.floor(el.currentTime);
      record({ data: { videoId, positionSec: pos, completed: true } }).catch(() => {});
      onProgress?.(pos, true);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [cloudUrl, source, authed, initialPosition, record, videoId, onProgress]);

  if (isPremium && !canWatchPremium) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Gold members only</p>
          <p className="mt-1 text-xs text-muted-foreground">Upgrade to unlock this lesson.</p>
        </div>
      </div>
    );
  }

  if (source === "youtube" && externalId) {
    const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
    if (initialPosition > 5) params.set("start", String(initialPosition));
    return (
      <div className="aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${externalId}?${params.toString()}`}
          title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (source === "vimeo" && externalId) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg bg-black">
        <iframe
          className="h-full w-full"
          src={`https://player.vimeo.com/video/${externalId}?title=0&byline=0#t=${initialPosition}s`}
          title="Lesson video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (source === "cloud") {
    if (!authed) {
      return (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
          Sign in to watch this lesson.
        </div>
      );
    }
    if (cloudError) {
      return (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card text-sm text-destructive">
          {cloudError}
        </div>
      );
    }
    if (!cloudUrl) {
      return (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
          Loading video…
        </div>
      );
    }
    return (
      <div className="aspect-video overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          className="h-full w-full"
          src={cloudUrl}
          controls
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
      Video unavailable.
    </div>
  );
}
