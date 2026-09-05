"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Repeat,
  Award,
  Scissors,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { SalesChart, PeakHoursChart } from "@/components/domain/charts";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import {
  SALES_TREND,
  PEAK_HOURS,
  TOP_SERVICES,
  STAFF,
  CUSTOMERS,
} from "@/lib/mock/data";
import { formatCurrency, initials, todayIso } from "@/lib/utils";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const RANGES = [
  { id: "today", label: "Today", from: () => todayIso() },
  { id: "7d", label: "7 days", from: () => daysAgoIso(6) },
  { id: "30d", label: "30 days", from: () => daysAgoIso(29) },
  { id: "all", label: "All time", from: () => "" },
] as const;

export default function OwnerReportsPage() {
  const allSales = useAppStore((s) => s.sales);

  const [from, setFrom] = useState(() => daysAgoIso(29));
  const [to, setTo] = useState(() => todayIso());

  const sales = useMemo(
    () =>
      allSales.filter((s) => {
        const day = s.createdAt.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      }),
    [allSales, from, to],
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = totalRevenue / Math.max(sales.length, 1);

  const topStaff = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    sales.forEach((s) => {
      const cur = map.get(s.staffId) ?? { total: 0, count: 0 };
      map.set(s.staffId, { total: cur.total + s.total, count: cur.count + 1 });
    });
    return STAFF.filter((s) => s.role === "barber")
      .map((staff) => ({
        staff,
        ...(map.get(staff.id) ?? { total: 0, count: 0 }),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales]);

  const returningRate = useMemo(() => {
    const repeat = CUSTOMERS.filter((c) => c.visits >= 3).length;
    return Math.round((repeat / CUSTOMERS.length) * 100);
  }, []);

  const retentionStats = {
    returning: returningRate,
    newThisMonth: CUSTOMERS.filter((c) => c.visits <= 2).length,
    avgVisits: (
      CUSTOMERS.reduce((s, c) => s + c.visits, 0) / CUSTOMERS.length
    ).toFixed(1),
  };

  const maxServiceCount = TOP_SERVICES[0]?.count ?? 1;

  return (
    <>
      <Topbar title="Reports & Analytics" />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setFrom(r.from());
                      setTo(todayIso());
                    }}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--gold-dim)] hover:text-[var(--text)]"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-[var(--text-faint)]">
                {sales.length} of {allSales.length} sales
              </span>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(totalRevenue)}
              change={`${sales.length} transactions`}
              trend="up"
              icon={TrendingUp}
              delay={0}
            />
            <StatCard
              label="Avg Ticket"
              value={formatCurrency(avgTicket)}
              change="Per transaction"
              trend="neutral"
              icon={Award}
              delay={0.05}
            />
            <StatCard
              label="Returning Rate"
              value={`${retentionStats.returning}%`}
              change={`${retentionStats.newThisMonth} new customers`}
              trend="up"
              icon={Repeat}
              delay={0.1}
            />
            <StatCard
              label="Avg Visits"
              value={retentionStats.avgVisits}
              change="Per customer lifetime"
              trend="neutral"
              icon={Users}
              delay={0.15}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SalesChart data={SALES_TREND} title="Weekly Sales Trend" />
            <PeakHoursChart data={PEAK_HOURS} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-[var(--gold)]" />
                  Top Staff
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {topStaff.map((entry, i) => (
                  <motion.div
                    key={entry.staff.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 rounded-xl bg-[var(--bg-muted)]/50 p-3"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--gold)]/15 text-xs font-bold text-[var(--gold-soft)]">
                      {i + 1}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)]/10 font-display text-[10px] font-semibold text-[var(--gold-soft)]">
                      {initials(entry.staff.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.staff.name}</p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {entry.count} sales
                      </p>
                    </div>
                    <p className="font-semibold text-[var(--gold-soft)]">
                      {formatCurrency(entry.total)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-[var(--gold)]" />
                  Top Services
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {TOP_SERVICES.map((svc, i) => (
                  <div key={svc.name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{svc.name}</span>
                      <span className="text-[var(--text-muted)]">{svc.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full gold-gradient"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(svc.count / maxServiceCount) * 100}%`,
                        }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-[var(--gold)]" />
                  Retention
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4 text-center">
                  <p className="font-display text-4xl font-bold text-[var(--gold-soft)]">
                    {retentionStats.returning}%
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Returning customer rate
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                    <p className="text-xs text-[var(--text-faint)]">New (≤2 visits)</p>
                    <p className="font-display text-xl font-semibold">
                      {retentionStats.newThisMonth}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                    <p className="text-xs text-[var(--text-faint)]">Members</p>
                    <p className="font-display text-xl font-semibold">
                      {CUSTOMERS.filter((c) => c.membership !== "none").length}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-faint)]">
                  Customers with 3+ visits are counted as returning. Membership
                  tiers drive repeat bookings and higher lifetime value.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>
    </>
  );
}
