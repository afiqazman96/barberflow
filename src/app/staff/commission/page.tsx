"use client";

import { motion } from "framer-motion";
import { Wallet, TrendingUp, Info, Receipt } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/domain/stat-card";
import { COMMISSION_RULES } from "@/lib/mock/data";
import { useStaffPortal } from "@/hooks/use-staff-portal";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function StaffCommissionPage() {
  const { staff, staffSales } = useStaffPortal();

  const todaySalesTotal = staffSales.reduce((sum, s) => sum + s.total, 0);
  const todayCommissionTotal = staffSales.reduce((sum, s) => sum + s.commission, 0);

  const activeRules = COMMISSION_RULES.filter((r) => r.active);

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          Earnings
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Commission
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Your cut from services & retail
        </p>
      </motion.header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today"
          value={formatCurrency(staff.todayCommission)}
          change={`${formatCurrency(todayCommissionTotal)} live`}
          trend="up"
          icon={Wallet}
          delay={0.05}
        />
        <StatCard
          label="This Month"
          value={formatCurrency(staff.monthlyCommission)}
          change={`${formatCurrency(staff.monthlySales)} sales`}
          trend="up"
          icon={TrendingUp}
          delay={0.1}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s breakdown</CardTitle>
          <span className="text-sm text-[var(--text-muted)]">
            {staffSales.length} transactions
          </span>
        </CardHeader>
        {staffSales.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">
            No sales recorded yet today
          </p>
        ) : (
          <div className="space-y-2">
            {staffSales.slice(0, 8).map((sale, i) => (
              <motion.div
                key={sale.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{sale.customerName}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {sale.items.map((i) => i.name).join(" · ")}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                    <Receipt className="h-3 w-3" />
                    {sale.receiptNo} · {formatDateTime(sale.createdAt)}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="font-display font-semibold text-[var(--gold-soft)]">
                    +{formatCurrency(sale.commission)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    on {formatCurrency(sale.total)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {staffSales.length > 0 && (
          <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4 text-sm">
            <span className="text-[var(--text-muted)]">Session total</span>
            <span className="font-display font-semibold">
              {formatCurrency(todayCommissionTotal)} / {formatCurrency(todaySalesTotal)}
            </span>
          </div>
        )}
      </Card>

      <Card className="border-[var(--gold)]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--gold)]" />
            Commission rules
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {activeRules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-[var(--bg-muted)]/60 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-[var(--text-faint)]">
                  {rule.appliesTo === "all"
                    ? "All items"
                    : rule.appliesTo.charAt(0).toUpperCase() + rule.appliesTo.slice(1)}
                  {rule.staffId && rule.staffId === staff.id && " · Your override"}
                </p>
              </div>
              <Badge variant="gold">
                {rule.type === "percentage"
                  ? `${rule.value}%`
                  : rule.type === "fixed"
                    ? formatCurrency(rule.value)
                    : `+${rule.value}%`}
              </Badge>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--text-faint)]">
          Commissions are calculated at checkout. Your personal override ({staff.name}) applies
          a boosted rate on all eligible sales. Campaign bonuses stack on top.
        </p>
      </Card>
    </div>
  );
}
