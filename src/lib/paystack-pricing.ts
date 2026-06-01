// Client-safe pricing config (no server imports).
export const TIER_PRICING = {
  plus: { amount_kobo: 250000, label: "Hamduk Plus", monthly_ngn: 2500 },
  gold: { amount_kobo: 700000, label: "Hamduk Gold", monthly_ngn: 7000 },
} as const;

export type PaidTier = keyof typeof TIER_PRICING;
