"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { BookingCard } from "@/components/domain/booking-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/app-store";
import type { Booking } from "@/lib/types";
import { formatDate, todayIso } from "@/lib/utils";

export default function OwnerAppointmentPage() {
  const bookings = useAppStore((s) => s.bookings);
  const updateBooking = useAppStore((s) => s.updateBooking);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState(todayIso);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const dates = useMemo(() => {
    const set = new Set(bookings.map((b) => b.date));
    return Array.from(set).sort();
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        const matchSearch =
          !search ||
          b.customerName.toLowerCase().includes(search.toLowerCase()) ||
          b.customerPhone.includes(search);
        const matchStatus = statusFilter === "all" || b.status === statusFilter;
        const matchDate = viewMode === "calendar" ? b.date === dateFilter : true;
        return matchSearch && matchStatus && matchDate;
      })
      .sort((a, b) => {
        const da = `${a.date}T${a.time}`;
        const db = `${b.date}T${b.time}`;
        return da.localeCompare(db);
      });
  }, [bookings, search, statusFilter, dateFilter, viewMode]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Booking[]> = {};
    filtered.forEach((b) => {
      if (!groups[b.date]) groups[b.date] = [];
      groups[b.date].push(b);
    });
    return groups;
  }, [filtered]);

  const today = todayIso();
  const todayCount = bookings.filter((b) => b.date === today).length;
  const confirmedCount = bookings.filter(
    (b) => b.date === today && b.status === "confirmed",
  ).length;

  function handleMarkComplete(booking: Booking) {
    updateBooking(booking.id, { status: "completed" });
    toast.success("Appointment completed", { description: booking.customerName });
    setSelected({ ...booking, status: "completed" });
  }

  function handleMarkNoShow(booking: Booking) {
    updateBooking(booking.id, { status: "no-show" });
    toast.error("Marked as no-show", { description: booking.customerName });
    setSelected({ ...booking, status: "no-show" });
  }

  function shiftDate(dir: -1 | 1) {
    const idx = dates.indexOf(dateFilter);
    const next = dates[idx + dir];
    if (next) setDateFilter(next);
  }

  return (
    <>
      <Topbar title="Appointments" />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="flex items-center gap-3 p-4">
              <Calendar className="h-8 w-8 text-[var(--gold)]" />
              <div>
                <p className="text-xs text-[var(--text-faint)]">Today</p>
                <p className="font-display text-xl font-semibold">{todayCount}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <CheckCircle className="h-8 w-8 text-[var(--success)]" />
              <div>
                <p className="text-xs text-[var(--text-faint)]">Confirmed</p>
                <p className="font-display text-xl font-semibold">{confirmedCount}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <div>
                <p className="text-xs text-[var(--text-faint)]">Total Bookings</p>
                <p className="font-display text-xl font-semibold">{bookings.length}</p>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                className="pl-10"
                placeholder="Search by name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="completed">Completed</option>
              <option value="no-show">No Show</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  viewMode === "list"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  viewMode === "calendar"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                By Day
              </button>
            </div>
          </div>

          {viewMode === "calendar" && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="font-display font-semibold">{formatDate(dateFilter)}</p>
                <p className="text-xs text-[var(--text-faint)]">
                  {filtered.length} appointment{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => shiftDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {viewMode === "list" ? (
            Object.entries(groupedByDate).map(([date, dayBookings]) => (
              <div key={date}>
                <h3 className="mb-3 font-display text-sm font-semibold text-[var(--text-muted)]">
                  {formatDate(date)}
                  <span className="ml-2 text-[var(--text-faint)]">
                    ({dayBookings.length})
                  </span>
                </h3>
                <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {dayBookings.map((booking, i) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <BookingCard
                        booking={booking}
                        onClick={() => setSelected(booking)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {filtered.map((booking, i) => (
                <motion.button
                  key={booking.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(booking)}
                  className="flex w-full items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-4 py-3 text-left transition hover:border-[var(--gold)]/30 hover:bg-[var(--bg-muted)]"
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-lg font-bold text-[var(--gold-soft)]">
                      {booking.time}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{booking.customerName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {booking.serviceNames.join(" · ")} · {booking.staffName}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </motion.button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <Card className="py-12 text-center text-[var(--text-muted)]">
              No appointments match your filters.
            </Card>
          )}
        </div>
      </PageTransition>

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.customerName}
        description={selected ? `${selected.date} · ${selected.time}` : ""}
      >
        {selected && (
          <div className="space-y-5">
            <StatusBadge status={selected.status} />
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <p>{selected.customerPhone}</p>
              <p>{selected.serviceNames.join(" · ")}</p>
              <p>
                {selected.staffName} · {selected.durationMins} min
              </p>
              <p className="text-xs text-[var(--text-faint)]">
                Grace period: {selected.gracePeriodMins} minutes
              </p>
            </div>
            {!["completed", "no-show", "cancelled"].includes(selected.status) && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => handleMarkComplete(selected)}>
                  <CheckCircle className="h-4 w-4" />
                  Mark Complete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleMarkNoShow(selected)}
                  className="border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                >
                  <XCircle className="h-4 w-4" />
                  Mark No-Show
                </Button>
              </div>
            )}
            {selected.status === "completed" && (
              <p className="text-center text-sm text-[var(--success)]">
                This appointment has been completed.
              </p>
            )}
            {selected.status === "no-show" && (
              <p className="text-center text-sm text-[var(--danger)]">
                Customer marked as no-show.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
