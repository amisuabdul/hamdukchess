import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import { upgradeGuestAccount, useAuth } from "@/lib/auth";

export function GuestUpgradeBanner() {
  const { isGuest } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isGuest || dismissed) return null;

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await upgradeGuestAccount(email, password, username || undefined);
      toast.success("Account saved! Your rating and games are preserved.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/10 via-primary/5 to-accent/10">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">You're playing as a guest</p>
            <p className="text-sm text-muted-foreground">Save your rating, games, and puzzle progress with a free account — no progress lost.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save progress
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-card/70 p-4 sm:p-5">
          <form onSubmit={handleUpgrade} className="grid gap-3 sm:grid-cols-3">
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Password (8+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Username (optional)"
              pattern="[a-zA-Z0-9_]{3,20}"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:col-span-3"
            >
              {busy ? "Saving…" : "Create account & keep progress"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
