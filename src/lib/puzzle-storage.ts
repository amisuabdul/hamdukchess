// LocalStorage-backed puzzle progress. Will migrate to Cloud once auth lands.

const KEY = "hamduk:puzzle-progress:v1";

export type PuzzleProgress = {
  solvedIds: string[];
  failedIds: string[];
  attemptsToday: number;
  attemptsDate: string; // YYYY-MM-DD
  streakDays: number;
  lastSolveDate: string | null; // YYYY-MM-DD
  rating: number;
  totalSolved: number;
};

const DEFAULT: PuzzleProgress = {
  solvedIds: [],
  failedIds: [],
  attemptsToday: 0,
  attemptsDate: todayKey(),
  streakDays: 0,
  lastSolveDate: null,
  rating: 1200,
  totalSolved: 0,
};

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function loadProgress(): PuzzleProgress {
  if (typeof localStorage === "undefined") return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = { ...DEFAULT, ...JSON.parse(raw) } as PuzzleProgress;
    // Reset daily counter on new day
    const today = todayKey();
    if (parsed.attemptsDate !== today) {
      parsed.attemptsDate = today;
      parsed.attemptsToday = 0;
    }
    return parsed;
  } catch {
    return { ...DEFAULT };
  }
}

export function saveProgress(p: PuzzleProgress) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function recordAttempt(puzzleId: string, success: boolean, puzzleRating: number): PuzzleProgress {
  const p = loadProgress();
  p.attemptsToday += 1;
  const today = todayKey();

  if (success && !p.solvedIds.includes(puzzleId)) {
    p.solvedIds.push(puzzleId);
    p.totalSolved += 1;

    // Update streak
    if (p.lastSolveDate) {
      const last = new Date(p.lastSolveDate);
      const diff = Math.round((Date.parse(today) - last.getTime()) / 86400000);
      if (diff === 0) {
        // same day, keep streak
      } else if (diff === 1) {
        p.streakDays += 1;
      } else {
        p.streakDays = 1;
      }
    } else {
      p.streakDays = 1;
    }
    p.lastSolveDate = today;

    // Elo-style update K=20
    const expected = 1 / (1 + Math.pow(10, (puzzleRating - p.rating) / 400));
    p.rating = Math.round(p.rating + 20 * (1 - expected));
  } else if (!success) {
    if (!p.failedIds.includes(puzzleId)) p.failedIds.push(puzzleId);
    const expected = 1 / (1 + Math.pow(10, (puzzleRating - p.rating) / 400));
    p.rating = Math.max(400, Math.round(p.rating + 20 * (0 - expected)));
  }

  saveProgress(p);
  return p;
}
