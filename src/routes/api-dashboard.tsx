import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, RefreshCw, Trash2, Webhook, Copy } from "lucide-react";
import { API_SCOPES, SCOPE_DESCRIPTIONS, WEBHOOK_EVENTS } from "@/lib/api-scopes";
import {
  getApiAccess,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  regenerateApiKey,
  listWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  setWebhookEnabled,
} from "@/lib/api.functions";

export const Route = createFileRoute("/api-dashboard")({
  head: () => ({
    meta: [
      { title: "Developer API dashboard | Hamduk Chess" },
      {
        name: "description",
        content:
          "Create API keys, set scopes, track monthly usage and configure webhooks for chess clubs, schools and academies.",
      },
      { property: "og:title", content: "Developer API dashboard | Hamduk Chess" },
      {
        property: "og:description",
        content: "API keys, scopes, usage stats, webhooks and embeddable widgets for chess organisations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiDashboard,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Not found</div>,
});

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>;
}

function ApiDashboard() {
  const qc = useQueryClient();
  const access = useQuery({ queryKey: ["api-access"], queryFn: () => getApiAccess() });
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => listApiKeys(),
    enabled: access.data?.allowed === true,
  });
  const hooks = useQuery({
    queryKey: ["api-webhooks"],
    queryFn: () => listWebhooks(),
    enabled: access.data?.allowed === true,
  });

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["board:embed"]);
  const [limit, setLimit] = useState(10000);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>(["game.completed"]);
  const [hookSecret, setHookSecret] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createApiKey({ data: { name, scopes: scopes as never, monthlyLimit: limit } }),
    onSuccess: (res) => {
      setPlaintext(res.plaintext);
      setName("");
      toast.success("API key created — copy it now, it won't be shown again");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey({ data: { id } }),
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenerateApiKey({ data: { id } }),
    onSuccess: (res) => {
      setPlaintext(res.plaintext);
      toast.success("Key regenerated — the old key is revoked");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addHook = useMutation({
    mutationFn: () => createWebhook({ data: { url: hookUrl, events: hookEvents as never } }),
    onSuccess: (res) => {
      setHookSecret(res.secret);
      setHookUrl("");
      toast.success("Webhook registered");
      qc.invalidateQueries({ queryKey: ["api-webhooks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeHook = useMutation({
    mutationFn: (id: string) => deleteWebhook({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-webhooks"] });
    },
  });

  const tryHook = useMutation({
    mutationFn: (id: string) => testWebhook({ data: { id } }),
    onSuccess: (res) =>
      res.ok ? toast.success(`Delivered (HTTP ${res.status})`) : toast.error(res.error ?? "Delivery failed"),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleHook = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => setWebhookEnabled({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-webhooks"] }),
  });

  if (access.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!access.data?.allowed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold text-foreground">Developer API</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The Hamduk Chess API — embeddable widgets, org ratings & games, tournaments, class sessions and
          webhooks — is available on Gold and organisation accounts.
        </p>
        <Link
          to="/billing"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Upgrade to Gold
        </Link>
      </main>
    );
  }

  const usage = keys.data?.usage;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-serif text-3xl font-bold text-foreground">Developer API</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Base URL <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/public/v1</code> · authenticate
        with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer &lt;key&gt;</code>
      </p>

      {plaintext && (
        <Card className="mt-6 border-primary/40 bg-primary/5">
          <p className="text-sm font-semibold text-foreground">Your new API key (shown once)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-xs">{plaintext}</code>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(plaintext);
                toast.success("Copied");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        </Card>
      )}

      {/* Usage */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Calls this month</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{usage?.total ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Errors</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{usage?.errors ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted-foreground">Active keys</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {(keys.data?.keys ?? []).filter((k) => !k.revoked_at).length}
          </p>
        </Card>
      </div>

      {usage && usage.byEndpoint.length > 0 && (
        <Card className="mt-3">
          <p className="text-sm font-semibold text-foreground">Calls by endpoint</p>
          <ul className="mt-2 space-y-1 text-sm">
            {usage.byEndpoint.map((e) => (
              <li key={e.endpoint} className="flex justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">{e.endpoint}</span>
                <span className="font-mono text-xs">{e.calls}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Keys */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" /> API keys
        </h2>

        <Card className="mt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Key name (e.g. Lagos Academy site)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={limit}
              min={100}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Monthly call limit"
            />
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {API_SCOPES.map((s) => (
              <label key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={scopes.includes(s)}
                  onChange={(e) =>
                    setScopes((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                  }
                  className="mt-0.5"
                />
                <span>
                  <code className="font-mono text-foreground">{s}</code> — {SCOPE_DESCRIPTIONS[s]}
                </span>
              </label>
            ))}
          </div>
          <button
            disabled={!name || scopes.length === 0 || create.isPending}
            onClick={() => create.mutate()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Create key
          </button>
        </Card>

        <div className="mt-3 space-y-2">
          {(keys.data?.keys ?? []).map((k) => (
            <Card key={k.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {k.name}{" "}
                  {k.revoked_at && <span className="text-xs font-normal text-destructive">revoked</span>}
                </p>
                <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}….••••</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {k.callsThisMonth}/{k.monthly_limit} calls · {(k.scopes ?? []).join(", ")}
                </p>
              </div>
              {!k.revoked_at && (
                <div className="flex gap-2">
                  <button
                    onClick={() => regenerate.mutate(k.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                  <button
                    onClick={() => revoke.mutate(k.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1.5 text-xs text-destructive hover:bg-accent"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Webhooks */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
          <Webhook className="h-4 w-4 text-primary" /> Webhooks
        </h2>

        {hookSecret && (
          <Card className="mt-3 border-primary/40 bg-primary/5">
            <p className="text-sm font-semibold text-foreground">Signing secret (shown once)</p>
            <code className="mt-1 block overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-xs">
              {hookSecret}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              Verify the <code className="font-mono">x-hamduk-signature</code> header (HMAC-SHA256 of the raw body).
            </p>
          </Card>
        )}

        <Card className="mt-3">
          <input
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://your-site.com/hooks/hamduk"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hookEvents.includes(ev)}
                  onChange={(e) =>
                    setHookEvents((prev) => (e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)))
                  }
                />
                <code className="font-mono text-foreground">{ev}</code>
              </label>
            ))}
          </div>
          <button
            disabled={!hookUrl || hookEvents.length === 0 || addHook.isPending}
            onClick={() => addHook.mutate()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add webhook
          </button>
        </Card>

        <div className="mt-3 space-y-2">
          {(hooks.data?.webhooks ?? []).map((h) => (
            <Card key={h.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">{h.url}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(h.events ?? []).join(", ")} · {h.failure_count} failures
                  {h.disabled && <span className="text-destructive"> · disabled</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => tryHook.mutate(h.id)}
                  className="rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent"
                >
                  Test
                </button>
                <button
                  onClick={() => toggleHook.mutate({ id: h.id, enabled: h.disabled })}
                  className="rounded-md border border-input px-2 py-1.5 text-xs hover:bg-accent"
                >
                  {h.disabled ? "Enable" : "Disable"}
                </button>
                <button
                  onClick={() => removeHook.mutate(h.id)}
                  className="rounded-md border border-input px-2 py-1.5 text-xs text-destructive hover:bg-accent"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>

        {(hooks.data?.deliveries ?? []).length > 0 && (
          <Card className="mt-3">
            <p className="text-sm font-semibold text-foreground">Recent deliveries</p>
            <ul className="mt-2 space-y-1 text-xs">
              {(hooks.data?.deliveries ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-muted-foreground">{d.event}</span>
                  <span className={d.status === "delivered" ? "text-primary" : "text-destructive"}>
                    {d.status} {d.response_status ? `(${d.response_status})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </main>
  );
}
