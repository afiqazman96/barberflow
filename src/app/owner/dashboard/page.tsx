"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  ListOrdered,
  CalendarDays,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatCard } from "@/components/domain/stat-card";
import { StaffCard } from "@/components/domain/staff-card";
import { SalesChart } from "@/components/domain/charts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { STAFF, SALES_TREND, TOP_SERVICES, CUSTOMERS } from "@/lib/mock/data";
import { formatCurrency } from "@/lib/utils";

export default function OwnerDashboardPage() {
  const queue = useAppStore((s) => s.queue);
  const sales = useAppStore((s) => s.sales);
  const bookings = useAppStore((s) => s.bookings);
  const staffStatuses = useAppStore((s) => s.staffStatuses);

  const today = "2026-07-30";
  const todaySales = sales.reduce((sum, s) => sum + s.total, 0);
  const waiting = queue.filter((q) => q.status === "waiting").length;
  const todayBookings = bookings.filter((b) => b.date === today).length;
  const avgWait =
    queue.filter((q) => q.status === "waiting").reduce((sum, q) => sum + q.estimatedWaitMins, 0) /
      Math.max(waiting, 1);
  const uniqueCustomers = new Set(sales.map((s) => s.customerId)).size;
  const barbers = STAFF.filter((s) => s.role === "barber");
  const maxServiceCount = TOP_SERVICES[0]?.count ?? 1;

  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            Fade House · Owner Portal
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Today's Sales"
              value={formatCurrency(todaySales)}
              change={`${sales.length} transactions`}
              trend="up"
              icon={DollarSign}
              delay={0}
            />
            <StatCard
              label="Customers"
              value={String(uniqueCustomers)}
              change={`${CUSTOMERS.length} in CRM`}
              trend="up"
              icon={Users}
              delay={0.05}
            />
            <StatCard
              label="Queue"
              value={String(waiting)}
              change={`${queue.filter((q) => q.status === "in-service").length} in service`}
              trend={waiting > 5 ? "up" : "neutral"}
              icon={ListOrdered}
              delay={0.1}
            />
            <StatCard
              label="Bookings"
              value={String(todayBookings)}
              change={`${bookings.filter((b) => b.status === "confirmed").length} confirmed`}
              trend="neutral"
              icon={CalendarDays}
              delay={0.15}
            />
            <StatCard
              label="Avg Wait"
              value={`${Math.round(avgWait)} min`}
              change={waiting > 0 ? "Live estimate" : "Queue clear"}
              trend={avgWait > 20 ? "down" : "neutral"}
              icon={Clock}
              delay={0.2}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesChart data={SALES_TREND} title="Weekly Sales Trend" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--gold)]" />
                  Top Services
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {TOP_SERVICES.map((svc, i) => (
                  <motion.div
                    key={svc.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{svc.name}</span>
                      <span className="text-[var(--text-muted)]">{svc.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <motion.div
                        className="h-full rounded-full gold-gradient"
                        initial={{ width: 0 }}
                        animate={{ width: `${(svc.count / maxServiceCount) * 100}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[var(--text-faint)]">
                Based on last 30 days · Fade House KL
              </p>
            </Card>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Live Staff Panel</h2>
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  {barbers.filter((b) => staffStatuses[b.id] === "available").length} available
                </Badge>
                <Badge variant="warning">
                  {barbers.filter((b) => staffStatuses[b.id] === "busy").length} busy
                </Badge>
              </div>
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
                    transition={{ delay: 0.25 + i * 0.05 }}
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
