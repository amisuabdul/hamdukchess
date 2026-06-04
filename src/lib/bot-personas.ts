// Nigerian bot personas — 13 Stockfish-driven opponents with depth caps,
// blunder injection, and eval-noise randomness. Legacy fields (skill,
// blunderChance, trait, tagline, avatar) preserved for existing callers.

export type BotTier = "free" | "plus";

export type BotPersona = {
  id: string;
  name: string;
  hometown: string;
  rating: number;
  /** Stockfish depth range — engine searches between these */
  depthMin: number;
  depthMax: number;
  /** 0..1 — chance of picking 2nd/3rd best move instead of best */
  blunderRate: number;
  /** Centipawn-scale eval noise added to MultiPV scoring */
  randomness: number;
  /** ms hard cap per move */
  movetimeMs: number;
  /** Catchphrase / personality blurb */
  catchphrase: string;
  bio: string;
  /** Opening UCI lines weighted toward Nigerian club favorites (head only) */
  openingRepertoire: string[];
  tier: BotTier;
  avatar: string;

  // ---- Legacy compatibility for existing ChessApp ----
  /** Mapped from depth range → 0..20 Stockfish skill */
  skill: number;
  /** Alias of blunderRate */
  blunderChance: number;
  tagline: string;
  trait: string;
};

function mkSkill(depthMax: number): number {
  // Rough map: depth 2→2, 4→6, 6→10, 8→13, 10→16, 12→18, 14→19, 20→20
  return Math.max(0, Math.min(20, Math.round((depthMax - 1) * 1.45)));
}

type Spec = Omit<BotPersona, "skill" | "blunderChance" | "tagline" | "trait">;

const SPECS: Spec[] = [
  { id: "army_legend",    name: "Army Legend",       hometown: "Abeokuta",       rating:  500, depthMin:  1, depthMax:  2, blunderRate: 0.15,  randomness: 0.30, movetimeMs: 300, catchphrase: "Still learning the pieces", bio: "Just discovered chess at the barracks. Loves the horsey.",            openingRepertoire: ["e2e4","d2d4"],         tier: "free", avatar: "🪖" },
  { id: "agbero",         name: "Agbero",            hometown: "Lagos Island",   rating:  800, depthMin:  2, depthMax:  4, blunderRate: 0.12,  randomness: 0.25, movetimeMs: 350, catchphrase: "Street smart, chess dumb",  bio: "Runs the motor park by day, hustles bullet by night.",                openingRepertoire: ["e2e4","b1c3"],         tier: "free", avatar: "🧢" },
  { id: "iyaamala",       name: "Iyaamala",          hometown: "Ibadan",         rating: 1000, depthMin:  3, depthMax:  5, blunderRate: 0.10,  randomness: 0.20, movetimeMs: 400, catchphrase: "Plays by feeling",          bio: "Sells amala by day, swindles club regulars by night.",                openingRepertoire: ["e2e4","g1f3"],         tier: "free", avatar: "🍲" },
  { id: "baba_ijebu",     name: "Baba Ijebu",        hometown: "Ijebu-Ode",      rating: 1200, depthMin:  4, depthMax:  6, blunderRate: 0.08,  randomness: 0.17, movetimeMs: 450, catchphrase: "Lucky but tricky",          bio: "Lottery kingpin. Believes every opening is a numbers game.",          openingRepertoire: ["e2e4","c2c4","d2d4"],  tier: "free", avatar: "🎲" },
  { id: "mama_cass",      name: "Mama Cass",         hometown: "Port Harcourt",  rating: 1400, depthMin:  5, depthMax:  7, blunderRate: 0.07,  randomness: 0.14, movetimeMs: 500, catchphrase: "Patient and dangerous",     bio: "Chess teacher at the Garden City club. Has notebooks of traps.",      openingRepertoire: ["d2d4","c2c4","e2e4"],  tier: "free", avatar: "👵" },
  { id: "area_father",    name: "Area Father",       hometown: "Mushin, Lagos",  rating: 1600, depthMin:  6, depthMax:  8, blunderRate: 0.05,  randomness: 0.12, movetimeMs: 550, catchphrase: "Controls the street",       bio: "Nothing moves in Mushin without his say. Same on the board.",         openingRepertoire: ["e2e4","d2d4","c2c4"],  tier: "plus", avatar: "🕶️" },
  { id: "zobo_master",    name: "Zobo Master",       hometown: "Kano",           rating: 1800, depthMin:  7, depthMax:  9, blunderRate: 0.04,  randomness: 0.10, movetimeMs: 600, catchphrase: "Calculated cool",           bio: "Sips zobo between moves. Has never been seen flustered.",             openingRepertoire: ["d2d4","g1f3","c2c4"],  tier: "plus", avatar: "🥤" },
  { id: "third_mainland", name: "Third Mainland",    hometown: "Lagos Mainland", rating: 2000, depthMin:  8, depthMax: 10, blunderRate: 0.03,  randomness: 0.08, movetimeMs: 700, catchphrase: "Long game thinker",         bio: "Plans like a bridge — long, deliberate, and unavoidable.",            openingRepertoire: ["d2d4","c2c4","g1f3"],  tier: "plus", avatar: "🌉" },
  { id: "eko_atlantic",   name: "Eko Atlantic",      hometown: "Eko Atlantic",   rating: 2200, depthMin:  9, depthMax: 11, blunderRate: 0.025, randomness: 0.06, movetimeMs: 800, catchphrase: "Built different",          bio: "New money, sharp lines. Plays Catalan in a Tom Ford suit.",           openingRepertoire: ["d2d4","g1f3","c2c4"],  tier: "plus", avatar: "🏙️" },
  { id: "queen_amina",    name: "Queen Amina",       hometown: "Zaria",          rating: 2400, depthMin: 10, depthMax: 12, blunderRate: 0.02,  randomness: 0.05, movetimeMs: 850, catchphrase: "Warrior queen",             bio: "Descendant of the warrior queen. Attacks with cavalry.",              openingRepertoire: ["e2e4","d2d4","c2c4"],  tier: "plus", avatar: "👑" },
  { id: "obafemi",        name: "Obafemi",           hometown: "Ile-Ife",        rating: 2600, depthMin: 11, depthMax: 13, blunderRate: 0.015, randomness: 0.04, movetimeMs: 900, catchphrase: "The professor",            bio: "OAU chess professor. Has published on the Najdorf.",                  openingRepertoire: ["e2e4","d2d4","c2c4"],  tier: "plus", avatar: "🎓" },
  { id: "oduduwa",        name: "Oduduwa",           hometown: "Ile-Ife",        rating: 2800, depthMin: 12, depthMax: 14, blunderRate: 0.01,  randomness: 0.03, movetimeMs: 1000, catchphrase: "Ancient and wise",         bio: "They say he taught the first Ife king to play. They might be right.", openingRepertoire: ["d2d4","c2c4","g1f3"],  tier: "plus", avatar: "🗿" },
  { id: "naija_legend",   name: "Naija Legend",      hometown: "Abuja",          rating: 3000, depthMin: 14, depthMax: 20, blunderRate: 0.005, randomness: 0.02, movetimeMs: 1200, catchphrase: "Unbeatable",               bio: "Nigeria's strongest engine-tuned super-GM. No one has scored a point.", openingRepertoire: ["e2e4","d2d4","c2c4","g1f3"], tier: "plus", avatar: "🦅" },
];

export const BOT_PERSONAS: BotPersona[] = SPECS.map((s) => ({
  ...s,
  skill: mkSkill(s.depthMax),
  blunderChance: s.blunderRate,
  tagline: s.catchphrase,
  trait: s.bio,
}));

export const DEFAULT_PERSONA_ID = "baba_ijebu";

export function getPersona(id: string): BotPersona {
  return BOT_PERSONAS.find((p) => p.id === id) ?? BOT_PERSONAS[3];
}

/** Pick the bot whose rating is closest to the player's */
export function nearestBot(rating: number, tier: BotTier = "free"): BotPersona {
  const pool = BOT_PERSONAS.filter((b) => tier === "plus" || b.tier === "free");
  return pool.reduce((best, b) =>
    Math.abs(b.rating - rating) < Math.abs(best.rating - rating) ? b : best,
  pool[0]);
}
