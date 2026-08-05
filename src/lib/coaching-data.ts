// Client-safe coaching constants (no server imports).

export const COACH_LANGUAGES = [
  "English",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Pidgin",
  "French",
  "Arabic",
  "Swahili",
  "Portuguese",
  "Spanish",
] as const;

export const COACH_SPECIALTIES = [
  "Openings",
  "Tactics",
  "Endgames",
  "Positional play",
  "Beginners",
  "Juniors",
  "Tournament prep",
  "Blitz & rapid",
  "Game analysis",
  "Chess960",
] as const;

export const FIDE_TITLES = ["GM", "IM", "FM", "CM", "WGM", "WIM", "WFM", "NM", "None"] as const;

export const SESSION_DURATIONS = [30, 45, 60, 90] as const;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function nairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString()}`;
}

export function minuteToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Price for a session of `duration_min` at an hourly rate in kobo. */
export function sessionPriceKobo(hourlyRateKobo: number, durationMin: number): number {
  return Math.round((hourlyRateKobo * durationMin) / 60);
}
