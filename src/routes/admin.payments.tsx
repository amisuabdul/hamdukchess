import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, EmptyState, Pager, PageHeader, naira, when } from "@/components/admin/AdminUi";
import { getRevenueBreakdown, listPayments } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments | Hamduk Chess staff" },
      { name: "description", content: "Paystack payment events and revenue breakdown." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPayments,
  errorComponent: ({ error }) => <div className="p-4 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Not found</div>,
});

function AdminPayments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [days, setDays] = useState(30);

  const payments = useQuery({
    queryKey: ["admin-payments", page, status],
    queryFn: () => listPayments({ data: { page, pageSize: 25, status } }),
  });
  const revenue = useQuery({
    queryKey: ["admin-revenue", days],
    queryFn: () => getRevenueBreakdown({ data: { days } }),
  });

  return (
    <div>
      <PageHeader title="Payments" subtitle="Paystack webhook events and revenue trend." />

      <Card className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-serif text-lg">
            {naira(revenue.data?.total ?? 0)} <span className="text-sm text-muted-foreground">last {days} days</span>
          </p>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div className="mt-3 h-48">
          {revenue.data ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue.data.series}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: number) => naira(v)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="naira" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
        {revenue.data?.byPlan.length ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {revenue.data.byPlan.map((p) => (
              <span key={p.plan} className="rounded-lg bg-muted px-3 py-1">
                {p.plan}: {naira(p.naira)}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg">Payment events</h2>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All events</option>
            <option value="charge.success">charge.success</option>
            <option value="subscription.create">subscription.create</option>
            <option value="subscription.disable">subscription.disable</option>
            <option value="invoice.payment_failed">invoice.payment_failed</option>
          </select>
        </div>
        {payments.isLoading ? (
          <EmptyState>Loading payments…</EmptyState>
        ) : !payments.data?.payments.length ? (
          <EmptyState>No payment events recorded.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-3">{p.username}</td>
                    <td className="py-2 pr-3">{p.event}</td>
                    <td className="py-2 pr-3">{p.plan_code ?? "—"}</td>
                    <td className="py-2 pr-3">{naira((p.amount ?? 0) / 100)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{p.reference ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{when(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pageSize={25} total={payments.data?.total ?? 0} onPage={setPage} />
        <p className="mt-2 text-xs text-muted-foreground">
          Refunds are issued in Paystack directly — this console only records events.
        </p>
      </Card>
    </div>
  );
}
