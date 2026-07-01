import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, Crown } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  initializePaystackCheckout,
  verifyPaystackTransaction,
} from "@/lib/paystack.functions";
import { TIER_PRICING, type PaidTier } from "@/lib/paystack-pricing";

const billingSearchSchema = z.object({
  reference: z.string().optional(),
  trxref: z.string().optional(),
});

export const Route = createFileRoute("/billing")({
  validateSearch: billingSearchSchema,
  head: () => ({
    meta: [
      { title: "Billing — Hamduk Chess" },
      { name: "description", content: "Upgrade to Hamduk Plus or Gold." },
    ],
  }),
  component: BillingPage,
});

const FEATURES: Record<PaidTier, string[]> = {
  plus: [
    "No ads",
    "All 13 Nigerian bot personas (500–3000)",
    "Unlimited daily puzzles + Puzzle Storm/Battle",
    "Full game review with engine analysis",
    "Correspondence + Chess960",
    "Create tournaments up to 64 players",
    "Extended board & piece themes",
  ],
  gold: [
    "Everything in Plus",
    "Deep Stockfish analysis (depth 20+)",
    "Opening explorer + repertoire builder",
    "Endgame tablebase (Syzygy ≤7 pieces)",
    "Personalised weakness detection",
    "Coach marketplace + video lessons",
    "Lagos Night & Naija exclusive themes",
    "Priority matchmaking + Gold badge",
    "Tournaments up to 256 players",
  ],
};

function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/billing" });
  const reference = search.reference ?? search.trxref;

  const initFn = useServerFn(initializePaystackCheckout);
  const verifyFn = useServerFn(verifyPaystackTransaction);
  const [loadingTier, setLoadingTier] = useState<PaidTier | null>(null);

  const getBilling = useServerFn(getMyBilling);
  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-tier", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const b = await getBilling({});
      return {
        subscription_tier: b.tier,
        subscription_status: b.status,
        subscription_renews_at: b.renewsAt,
      };
    },
  });

  // Verify on return from Paystack
  useEffect(() => {
    if (!reference || !user) return;
    verifyFn({ data: { reference } })
      .then((res) => {
        if (res.ok) {
          toast.success(`You're now on Hamduk ${res.tier === "gold" ? "Gold" : "Plus"}! 🎉`);
          refetch();
        } else {
          toast.error(`Payment ${res.status}. If you were charged, it will resolve via webhook shortly.`);
        }
        navigate({ to: "/billing", search: {}, replace: true });
      })
      .catch((e) => toast.error(e.message ?? "Verification failed"));
  }, [reference, user, verifyFn, navigate, refetch]);

  async function handleUpgrade(tier: PaidTier) {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setLoadingTier(tier);
    try {
      const callback_url = `${window.location.origin}/billing`;
      const res = await initFn({ data: { tier, callback_url } });
      window.location.href = res.authorization_url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout";
      toast.error(msg);
      setLoadingTier(null);
    }
  }

  const currentTier = profile?.subscription_tier ?? "free";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl">
          Upgrade your game
        </h1>
        <p className="mt-3 text-muted-foreground">
          Pay securely with Paystack — cards, bank transfer, or USSD.
        </p>
        {profile && currentTier !== "free" && (
          <p className="mt-2 text-sm text-primary">
            Current plan: <strong>Hamduk {currentTier === "gold" ? "Gold" : "Plus"}</strong>
            {profile.subscription_renews_at && (
              <> — renews {new Date(profile.subscription_renews_at).toLocaleDateString()}</>
            )}
          </p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <TierCard
          title="Free"
          tagline="Get started"
          price="₦0"
          icon={<Check className="h-5 w-5" />}
          features={[
            "Guest play, no signup",
            "5 bot opponents (500–1400)",
            "20 puzzles / day",
            "Join public tournaments & clubs",
            "Spectate live games",
          ]}
          current={currentTier === "free"}
        />

        <TierCard
          title="Plus"
          tagline="Most popular"
          highlight
          price={`₦${TIER_PRICING.plus.monthly_ngn.toLocaleString()}`}
          priceSub="/month"
          icon={<Sparkles className="h-5 w-5" />}
          features={FEATURES.plus}
          current={currentTier === "plus"}
          cta={
            <UpgradeButton
              tier="plus"
              loading={loadingTier === "plus"}
              disabled={!!loadingTier}
              onClick={() => handleUpgrade("plus")}
              current={currentTier === "plus"}
            />
          }
        />

        <TierCard
          title="Gold"
          tagline="Master tier"
          price={`₦${TIER_PRICING.gold.monthly_ngn.toLocaleString()}`}
          priceSub="/month"
          icon={<Crown className="h-5 w-5" />}
          features={FEATURES.gold}
          current={currentTier === "gold"}
          cta={
            <UpgradeButton
              tier="gold"
              loading={loadingTier === "gold"}
              disabled={!!loadingTier}
              onClick={() => handleUpgrade("gold")}
              current={currentTier === "gold"}
            />
          }
        />
      </div>
    </main>
  );
}

function TierCard({
  title,
  tagline,
  price,
  priceSub,
  icon,
  features,
  highlight,
  current,
  cta,
}: {
  title: string;
  tagline: string;
  price: string;
  priceSub?: string;
  icon: React.ReactNode;
  features: string[];
  highlight?: boolean;
  current?: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlight
          ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
          {tagline}
        </span>
      )}
      <div className="mb-4 flex items-center gap-2 text-primary">
        {icon}
        <h2 className="font-serif text-2xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="mb-6">
        <span className="text-4xl font-bold text-foreground">{price}</span>
        {priceSub && <span className="text-sm text-muted-foreground">{priceSub}</span>}
      </div>
      <ul className="mb-6 flex-1 space-y-2 text-sm text-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {cta ?? (
        <button
          disabled
          className="w-full rounded-md border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-muted-foreground"
        >
          {current ? "Current plan" : "Included"}
        </button>
      )}
    </div>
  );
}

function UpgradeButton({
  tier,
  loading,
  disabled,
  onClick,
  current,
}: {
  tier: PaidTier;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  current: boolean;
}) {
  if (current) {
    return (
      <button
        disabled
        className="w-full rounded-md border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary"
      >
        Current plan
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
        </>
      ) : (
        `Upgrade to ${tier === "gold" ? "Gold" : "Plus"}`
      )}
    </button>
  );
}
