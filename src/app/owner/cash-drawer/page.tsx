"use client";

import { motion } from "framer-motion";
import { Wallet, TriangleAlert } from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/domain/stat-card";
import { useAppStore, drawerExpected } from "@/lib/store/app-store";
import type { DrawerSession } from "@/lib/types";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

function sessionStats(s: DrawerSession) {
  const cashSales = s.movements
    .filter((m) => m.type === "sale")
    .reduce((sum, m) => sum + m.amount, 0);
  const adjustments = s.movements
    .filter((m) => m.type !== "sale")
    .reduce((sum, m) => sum + m.amount, 0);
  const expected = drawerExpected(s);
  const variance = (s.countedAmount ?? expected) - expected;
  return { cashSales, adjustments, expected, variance };
}

export default function OwnerCashDrawerPage() {
  const drawerSession = useAppStore((s) => s.drawerSession);
  const drawerHistory = useAppStore((s) => s.drawerHistory);

  const closed = drawerHistory.filter((s) => s.closedAt);
  const totalVariance = closed.reduce(
    (sum, s) => sum + sessionStats(s).variance,
    0,
  );
  const shortShifts = closed.filter((s) => sessionStats(s).variance < 0).length;

  return (
    <>
      <Topbar title="Cash Drawer" />
      <PageTransition>
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Shifts closed"
              value={String(closed.length)}
              change={drawerSession ? "1 open now" : "None open"}
              trend="neutral"
              icon={Wallet}
              delay={0}
            />
            <StatCard
              label="Net variance"
              value={formatCurrency(totalVariance)}
              change={totalVariance === 0 ? "Balanced" : "Across all shifts"}
              trend={
                totalVariance < 0 ? "down" : totalVariance > 0 ? "up" : "neutral"
              }
              icon={TriangleAlert}
              delay={0.05}
            />
            <StatCard
              label="Short shifts"
              value={String(shortShifts)}
              change={
                shortShifts > closed.length / 2 && closed.length > 2
                  ? "Worth a look"
                  : "Occasional"
              }
              trend={shortShifts > 0 ? "down" : "neutral"}
              icon={TriangleAlert}
              delay={0.1}
            />
          </div>

          {drawerSession && (
            <Card className="border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
              <CardHeader className="mb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" />
                  Open now — {drawerSession.cashierName}
                </CardTitle>
                <span className="text-xs text-[var(--text-faint)]">
                  since {formatTime(drawerSession.openedAt)}
                </span>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Field
                  label="Float"
                  value={formatCurrency(drawerSession.openingFloat)}
                />
                <Field
                  label="Cash sales"
                  value={formatCurrency(sessionStats(drawerSession).cashSales)}
                />
                <Field
                  label="Movements"
                  value={String(drawerSession.movements.length)}
                />
                <Field
                  label="Expected"
                  value={formatCurrency(drawerExpected(drawerSession))}
                  strong
                />
              </div>
            </Card>
          )}

          <Card className="p-0">
            <CardHeader className="p-4">
              <CardTitle>Shift history</CardTitle>
            </CardHeader>
            {closed.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-[var(--text-muted)]">
                No shifts have been closed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--bg-elevated)] text-xs uppercase tracking-wide text-[var(--text-faint)]">
                      <th className="px-4 py-2.5 text-left font-medium">
                        Cashier
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium">
                        Closed
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Cash sales
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Expected
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Counted
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Variance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {closed.map((s, i) => {
                      const st = sessionStats(s);
                      return (
                        <motion.tr
                          key={s.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        >
                          <td className="px-4 py-3 font-medium">
                            {s.cashierName}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">
                            {formatDate(s.closedAt ?? s.openedAt)}{" "}
                            {formatTime(s.closedAt ?? s.openedAt)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(st.cashSales)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(st.expected)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(s.countedAmount ?? 0)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium tabular-nums ${
                              st.variance < 0
                                ? "text-[var(--danger)]"
                                : st.variance > 0
                                  ? "text-[var(--info)]"
                                  : "text-[var(--success)]"
                            }`}
                          >
                            {st.variance > 0 && "+"}
                            {formatCurrency(st.variance)}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {closed.some((s) => s.closingNote) && (
            <Card className="p-4">
              <CardHeader className="mb-2">
                <CardTitle className="text-sm">Close-out notes</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                {closed
                  .filter((s) => s.closingNote)
                  .map((s) => (
                    <div key={s.id} className="text-[var(--text-muted)]">
                      <span className="font-medium text-[var(--text)]">
                        {s.cashierName}
                      </span>{" "}
                      · {formatDate(s.closedAt ?? s.openedAt)} — {s.closingNote}
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </PageTransition>
    </>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--text-faint)]">{label}</p>
      <p
        className={
          strong
            ? "font-display text-lg font-semibold text-[var(--gold-soft)]"
            : "font-medium"
        }
      >
        {value}
      </p>
    </div>
  );
}
