// Nigerian bot personas — named opponents with personalities,
// ELO-scaled Stockfish skill, and a blunder-injection chance.

export type BotPersona = {
  id: string;
  name: string;
  hometown: string;
  rating: number;
  /** Stockfish skill level 0–20 */
  skill: number;
  /** ms to think per move */
  movetimeMs: number;
  /** 0..1 — chance of playing a random legal move instead of the best one */
  blunderChance: number;
  /** Initials / emoji on the avatar */
  avatar: string;
  tagline: string;
  trait: string;
};

export const BOT_PERSONAS: BotPersona[] = [
  { id: "tunde",   name: "Tunde 'The Hawk' Adebayo",  hometown: "Lagos",       rating: 2350, skill: 20, movetimeMs: 900, blunderChance: 0.00, avatar: "🦅", tagline: "Tactical predator",       trait: "Punishes loose pawns instantly." },
  { id: "chinedu", name: "Chinedu Okafor",            hometown: "Enugu",       rating: 2180, skill: 18, movetimeMs: 800, blunderChance: 0.02, avatar: "♛", tagline: "Endgame technician",      trait: "Grinds rook endings forever." },
  { id: "amaka",   name: "Amaka 'Storm' Eze",         hometown: "Onitsha",     rating: 2050, skill: 16, movetimeMs: 700, blunderChance: 0.03, avatar: "⚡", tagline: "Attacking firebrand",     trait: "Sacrifices first, asks later." },
  { id: "femi",    name: "Femi Bankole",              hometown: "Ibadan",      rating: 1900, skill: 14, movetimeMs: 600, blunderChance: 0.05, avatar: "FB", tagline: "Steady positional",       trait: "Loves the Caro-Kann." },
  { id: "ibrahim", name: "Ibrahim Musa",              hometown: "Kano",        rating: 1780, skill: 12, movetimeMs: 600, blunderChance: 0.06, avatar: "IM", tagline: "Quiet strategist",        trait: "Patient maneuvering player." },
  { id: "ngozi",   name: "Ngozi 'Iron Queen' Umeh",  hometown: "Owerri",      rating: 1670, skill: 11, movetimeMs: 550, blunderChance: 0.08, avatar: "♕", tagline: "Defensive wall",          trait: "Will not crack under pressure." },
  { id: "kola",    name: "Kola Adeyemi",              hometown: "Abeokuta",    rating: 1560, skill: 10, movetimeMs: 500, blunderChance: 0.10, avatar: "KA", tagline: "Trappy club player",      trait: "Sets cheeky opening traps." },
  { id: "zainab",  name: "Zainab Bello",              hometown: "Kaduna",      rating: 1450, skill: 8,  movetimeMs: 500, blunderChance: 0.12, avatar: "ZB", tagline: "Improving fast",          trait: "Studies a new opening weekly." },
  { id: "obi",     name: "Obi 'Pawn King' Nwosu",     hometown: "Awka",        rating: 1340, skill: 7,  movetimeMs: 450, blunderChance: 0.14, avatar: "♟", tagline: "Pawn structure nerd",     trait: "Trades into king-and-pawn." },
  { id: "halima",  name: "Halima Sani",               hometown: "Sokoto",      rating: 1230, skill: 6,  movetimeMs: 450, blunderChance: 0.16, avatar: "HS", tagline: "University club star",    trait: "Solid in the opening, dicey later." },
  { id: "emeka",   name: "Emeka 'Hustle' Igwe",       hometown: "Aba",         rating: 1120, skill: 5,  movetimeMs: 400, blunderChance: 0.20, avatar: "EI", tagline: "Street-game scrapper",    trait: "Plays fast, swings wildly." },
  { id: "blessing",name: "Blessing Okon",             hometown: "Calabar",     rating: 1000, skill: 3,  movetimeMs: 400, blunderChance: 0.25, avatar: "BO", tagline: "Eager learner",           trait: "Will blunder a piece — but fights on." },
  { id: "junior",  name: "Junior 'Small Master'",     hometown: "Port Harcourt", rating: 850, skill: 2,  movetimeMs: 350, blunderChance: 0.30, avatar: "🧒", tagline: "Junior champion",         trait: "Bright sparks, occasional whoopsies." },
];

export const DEFAULT_PERSONA_ID = "femi";

export function getPersona(id: string): BotPersona {
  return BOT_PERSONAS.find((p) => p.id === id) ?? BOT_PERSONAS[3];
}
