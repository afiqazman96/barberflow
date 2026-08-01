"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  DollarSign,
  UserPlus,
  ShoppingCart,
  Scissors,
  ArrowRight,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatCard } from "@/components/domain/stat-card";
import { StaffCard } from "@/components/domain/staff-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { STAFF } from "@/lib/mock/data";
import { formatCurrency } from "@/lib/utils";

export default function CashierDashboardPage() {
  const queue = useAppStore((s) => s.queue);
  const sales = useAppStore((s) => s.sales);
  const staffStatuses = useAppStore((s) => s.staffStatuses);

  const waiting = queue.filter((q) => q.status === "waiting").length;
  const awaitingPay = queue.filter((q) => q.status === "awaiting-payment").length;
  const todaySales = sales.reduce((sum, s) => sum + s.total, 0);
  const serving = queue.find((q) => q.status === "in-service");
  const barbers = STAFF.filter((s) => s.role === "barber");

  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            Fade House · Cashier
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Queue Waiting"
              value={String(waiting)}
              change={`${queue.filter((q) => q.status === "called").length} called`}
              trend="neutral"
              icon={Users}
              delay={0}
            />
            <StatCard
              label="Awaiting Payment"
              value={String(awaitingPay)}
              change="Ready for checkout"
              trend={awaitingPay > 0 ? "up" : "neutral"}
              icon={CreditCard}
              delay={0.05}
            />
            <StatCard
              label="Today's Sales"
              value={formatCurrency(todaySales)}
              change={`${sales.length} transactions`}
              trend="up"
              icon={DollarSign}
              delay={0.1}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <Button asChild className="w-full" size="lg">
                  <Link href="/cashier/queue?register=1">
                    <UserPlus className="h-4 w-4" />
                    Register Walk-in
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full" size="lg">
                  <Link href="/cashier/pos">
                    <ShoppingCart className="h-4 w-4" />
                    Open POS
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/cashier/queue">
                    View Full Queue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>

            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--gold)]/5 to-transparent" />
                <CardHeader className="relative">
                  <div className="flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-[var(--gold)]" />
                    <CardTitle>Now Serving</CardTitle>
                  </div>
                </CardHeader>
                {serving ? (
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--gold)]/15 font-display text-2xl font-bold text-[var(--gold-soft)] pulse-gold">
                        {serving.number}
                      </div>
                      <div>
                        <p className="font-display text-xl font-semibold">
                          {serving.customerName}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">
                          {serving.serviceNames.join(" · ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge status={serving.status} />
                          {serving.assignedStaffId && (
                            <span className="text-xs text-[var(--text-faint)]">
                              with{" "}
                              {STAFF.find((s) => s.id === serving.assignedStaffId)
                                ?.name ?? "Barber"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/cashier/queue">Manage</Link>
                    </Button>
                  </div>
                ) : (
                  <p className="relative text-sm text-[var(--text-muted)]">
                    No customer currently in service. Check the queue for waiting
                    tickets.
                  </p>
                )}
              </Card>
            </motion.div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Live Staff</h2>
              <span className="text-xs text-[var(--text-faint)]">
                {barbers.filter((b) => staffStatuses[b.id] === "available").length}{" "}
                available
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((staff, i) => {
                const status = staffStatuses[staff.id];
                const currentCustomer = queue.find(
                  (q) =>
                    q.assignedStaffId === staff.id && q.status === "in-service",
                )?.customerName;
                return (
                  <motion.div
                    key={staff.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <StaffCard
                      staff={staff}
                      status={status}
                      currentCustomer={currentCustomer}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </PageTransition>
    </>
  );
}
