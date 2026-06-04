// Per-persona opening repertoires — UCI moves to bias the opening book.
// Currently used as a simple first-move book; will expand to multi-ply later.

export type OpeningBook = Record<string, string[]>;

export const OPENING_BOOKS: OpeningBook = {
  army_legend:    ["e2e4", "d2d4"],
  agbero:         ["e2e4", "b1c3", "g1f3"],
  iyaamala:       ["e2e4", "g1f3"],
  baba_ijebu:     ["e2e4", "c2c4", "d2d4"],
  mama_cass:      ["d2d4", "c2c4", "e2e4"],
  area_father:    ["e2e4", "d2d4", "c2c4"],
  zobo_master:    ["d2d4", "g1f3", "c2c4"],
  third_mainland: ["d2d4", "c2c4", "g1f3"],
  eko_atlantic:   ["d2d4", "g1f3", "c2c4"],
  queen_amina:    ["e2e4", "d2d4", "c2c4"],
  obafemi:        ["e2e4", "d2d4", "c2c4"],
  oduduwa:        ["d2d4", "c2c4", "g1f3"],
  naija_legend:   ["e2e4", "d2d4", "c2c4", "g1f3"],
};

export function bookMove(personaId: string): string | undefined {
  const list = OPENING_BOOKS[personaId];
  if (!list || list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}
