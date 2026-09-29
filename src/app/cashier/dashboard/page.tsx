"use client";

import { useMemo } from "react";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Clock,
  ListOrdered,
  Users,
  ArrowRight,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { HeroStatCard } from "@/components/domain/hero-stat-card";
import { StatTile } from "@/components/domain/stat-tile";
import { StaffCard } from "@/components/domain/staff-card";
import { CashierShiftControls } from "@/components/domain/cashier-shift";
import { MyShiftCard, WeekSchedule } from "@/components/domain/shift-cards";
import { useSession } from "@/components/auth/session-provider";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { STAFF } from "@/lib/mock/data";
import { weeklyTrend } from "@/lib/analytics";
import { formatCurrency, formatDateCompact, todayIso } from "@/lib/utils";

/** "Good morning" / "Good afternoon" / "Good evening", by the visitor's clock. */
function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function CashierDashboardPage() {
  const session = useSession();
  const allQueue = useAppStore((s) => s.queue);
  const activeBranchId = useAppStore((s) => s.branchId);
  const queue = useMemo(
    () => allQueue.filter((q) => q.branchId === activeBranchId),
    [allQueue, activeBranchId],
  );
  const allSales = useAppStore((s) => s.sales);
  const sales = useMemo(
    () => allSales.filter((x) => x.branchId === activeBranchId),
    [allSales, activeBranchId],
  );
  const allBookings = useAppStore((s) => s.bookings);
  const bookings = useMemo(
    () => allBookings.filter((b) => b.branchId === activeBranchId),
    [allBookings, activeBranchId],
  );
  const customers = useAppStore((s) => s.customers);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const myStaffId = session.staffId ?? "";

  const now = useMemo(() => new Date(), []);
  const today = todayIso();
  const waiting = queue.filter((q) => q.status === "waiting");
  const serving = queue.filter((q) => q.status === "in-service");
  const todaySalesList = sales.filter(
    (s) => !s.voided && s.createdAt.slice(0, 10) === today,
  );
  const todaySales = todaySalesList.reduce((sum, s) => sum + s.total, 0);
  const trend = useMemo(() => weeklyTrend(sales, now), [sales, now]);

  const todaysCustomers = new Set(todaySalesList.map((s) => s.customerId)).size;
  const todaysBookings = bookings.filter((b) => b.date === today);
  const confirmedBookings = todaysBookings.filter(
    (b) => b.status === "confirmed" || b.status === "checked-in",
  ).length;
  const avgWaitMins = waiting.length
    ? Math.round(
        waiting.reduce((sum, q) => sum + q.estimatedWaitMins, 0) / waiting.length,
      )
    : 0;

  // Up next: whoever is already on the floor or waiting, oldest first, then
  // today's still-upcoming confirmed bookings fill any remaining slots.
  const liveTickets = queue
    .filter((q) => q.status === "in-service" || q.status === "waiting" || q.status === "called")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 3);
  const upcomingBookings = todaysBookings
    .filter((b) => b.status === "confirmed" && b.time >= now.toTimeString().slice(0, 5))
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, Math.max(0, 3 - liveTickets.length));

  const barbers = STAFF.filter((s) => s.role === "barber");
  const firstName = session.name.split(" ")[0];

  return (
    <>
      <Topbar
        title=""
        actions={
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
          </button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-muted)]">
                {greetingFor(now.getHours())},
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {firstName}
              </h1>
            </div>
            <span className="mt-1 shrink-0 rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
              {formatDateCompact(now)}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HeroStatCard
                label="Today's sales"
                value={formatCurrency(todaySales)}
                pill={`${todaySalesList.length} transaction${todaySalesList.length === 1 ? "" : "s"}`}
                bars={trend.map((t, i) => ({
                  label: i === trend.length - 1 ? "Today" : t.day,
                  value: t.sales,
                }))}
              />
            </div>
            <div className="hidden lg:block">
              <CashierShiftControls />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={Users}
              chip="mint"
              value={String(todaysCustomers)}
              label={`Customers · ${customers.length} in CRM`}
              delay={0}
            />
            <StatTile
              icon={ListOrdered}
              chip="amber"
              value={String(waiting.length)}
              label={`Queue · ${serving.length} in service`}
              delay={0.05}
            />
            <StatTile
              icon={CalendarDays}
              chip="sky"
              value={String(todaysBookings.length)}
              label={`Bookings · ${confirmedBookings} confirmed`}
              delay={0.1}
            />
            <StatTile
              icon={Clock}
              chip="coral"
              value={String(avgWaitMins)}
              unit="min"
              label="Avg wait"
              delay={0.15}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Current queue</h2>
              <Link
                href="/cashier/queue"
                className="flex items-center gap-1 text-sm font-medium text-[var(--gold-soft)]"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="card-surface divide-y divide-[var(--border)] p-0">
              {liveTickets.length === 0 && upcomingBookings.length === 0 && (
                <p className="p-6 text-center text-sm text-[var(--text-muted)]">
                  Queue is clear right now.
                </p>
              )}
              {liveTickets.map((ticket, i) => {
                const barber = STAFF.find((s) => s.id === ticket.assignedStaffId);
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/12 font-display text-sm font-bold text-[var(--gold-soft)]">
                      {ticket.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {ticket.customerName}
                      </p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {ticket.status === "in-service"
                          ? `${ticket.serviceNames[0] ?? "Service"} · ${barber?.name ?? "Barber"}`
                          : `~${ticket.estimatedWaitMins} min wait`}
                      </p>
                    </div>
                    <Badge variant={ticket.status === "in-service" ? "success" : "warning"}>
                      {ticket.status === "in-service" ? "In chair" : "Waiting"}
                    </Badge>
                  </motion.div>
                );
              })}
              {upcomingBookings.map((booking, i) => (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (liveTickets.length + i) * 0.04 }}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chip-sky-bg)] text-[var(--chip-sky-fg)]">
                    <CalendarDays className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {booking.customerName}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {booking.serviceNames[0] ?? "Service"} ·{" "}
                      {booking.staffName || "Any barber"}
                    </p>
                  </div>
                  <Badge variant="info">Booking {booking.time}</Badge>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:hidden">
            <CashierShiftControls />
            <MyShiftCard staffId={myStaffId} />
          </div>
          <div className="hidden lg:block">
            <WeekSchedule staffId={myStaffId} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Live staff</h2>
              <span className="text-xs text-[var(--text-faint)]">
                {barbers.filter((b) => staffStatuses[b.id] === "available").length}{" "}
                available
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((staff, i) => {
                const status = staffStatuses[staff.id];
                const currentCustomer = queue.find(
                  (q) => q.assignedStaffId === staff.id && q.status === "in-service",
                )?.customerName;
                return (
                  <motion.div
                    key={staff.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
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
