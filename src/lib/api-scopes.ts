// Client-safe scope catalogue for the B2B API product.
export const API_SCOPES = [
  "board:embed",
  "games:read",
  "ratings:read",
  "tournaments:manage",
  "classes:manage",
  "webhooks",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "board:embed": "Generate embed tokens for board, puzzle, leaderboard and live-game widgets",
  "games:read": "Read game history, PGNs and results for org-linked users",
  "ratings:read": "Read current ratings of org-linked users",
  "tournaments:manage": "Create and manage private org tournaments",
  "classes:manage": "Run class sessions, broadcast positions, read student progress",
  webhooks: "Register webhooks and receive event payloads",
};

export const WEBHOOK_EVENTS = [
  "game.completed",
  "rating.changed",
  "tournament.round_complete",
  "class.session_started",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const EMBED_KINDS = ["board", "puzzle", "leaderboard", "game"] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];
