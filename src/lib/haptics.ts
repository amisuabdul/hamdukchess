// Lightweight haptic feedback. No-ops when unsupported or when the user
// prefers reduced motion. Pattern lengths are intentionally short (mobile
// browsers ignore long buzzes for non-installed PWAs).

type HapticKind = "move" | "capture" | "check" | "gameEnd" | "select" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  move: 8,
  select: 4,
  capture: [12, 30, 12],
  check: [20, 40, 20, 40, 20],
  gameEnd: [40, 60, 80],
  error: [30, 30, 30],
};

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function haptic(kind: HapticKind) {
  if (typeof navigator === "undefined") return;
  if (reducedMotion()) return;
  const v = (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate;
  if (typeof v !== "function") return;
  try { v.call(navigator, PATTERNS[kind]); } catch { /* ignore */ }
}
