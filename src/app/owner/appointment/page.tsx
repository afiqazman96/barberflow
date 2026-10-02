"use client";

import { useConfirm } from "@/hooks/use-confirm";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Search,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { BookingCard } from "@/components/domain/booking-card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PillTabs } from "@/components/ui/pill-tabs";
import { createStaffBooking } from "@/lib/bookings/actions";
import { useAppStore } from "@/lib/store/app-store";
import { isRosteredOn } from "@/lib/roster";
import type { Booking } from "@/lib/types";
import { cn, formatDate, todayIso } from "@/lib/utils";

const BORDER_BY_STATUS: Record<string, string> = {
  confirmed: "border-l-[var(--info)]",
  "checked-in": "border-l-[var(--warning)]",
  "in-service": "border-l-[var(--warning)]",
  completed: "border-l-[var(--success)]",
  "no-show": "border-l-[var(--danger)]",
  cancelled: "border-l-[var(--danger)]",
};

const emptyNewBooking = () => ({
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  serviceId: "",
  staffId: "",
  date: todayIso(),
  time: "10:00",
});

export default function OwnerAppointmentPage() {
  const confirm = useConfirm();
  const opsRules = useAppStore((s) => s.opsRules);
  const branchId = useAppStore((s) => s.branchId);
  const allBookings = useAppStore((s) => s.bookings);
  const services = useAppStore((s) => s.services);
  const staffList = useAppStore((s) => s.staff);
  const addBooking = useAppStore((s) => s.addBooking);
  const updateBooking = useAppStore((s) => s.updateBooking);

  const bookings = useMemo(
    () => allBookings.filter((b) => b.branchId === branchId),
    [allBookings, branchId],
  );
  const barbers = staffList.filter(
    (s) => s.role === "barber" && s.branchId === branchId && s.active,
  );
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState(todayIso);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBooking, setNewBooking] = useState(emptyNewBooking);
  // Only barbers actually working on the chosen date can be booked.
  const bookableBarbers = barbers.filter((b) =>
    isRosteredOn(roster, leaves, b.id, newBooking.date),
  );

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
    confirm.ask({
      title: `Mark ${booking.customerName} as no-show?`,
      confirmLabel: "No-show",
      run: () => {
        updateBooking(booking.id, { status: "no-show" });
        toast.error("Marked as no-show", { description: booking.customerName });
        setSelected({ ...booking, status: "no-show" });
      },
    });
  }

  function handleCancelBooking(booking: Booking) {
    confirm.ask({
      title: `Cancel ${booking.customerName}'s appointment?`,
      description: "Any queue ticket from their check-in is cancelled too.",
      confirmLabel: "Cancel appointment",
      run: () => {
        updateBooking(booking.id, { status: "cancelled" });
        toast.success("Appointment cancelled", { description: booking.customerName });
        setSelected({ ...booking, status: "cancelled" });
      },
    });
  }

  function shiftDate(dir: -1 | 1) {
    if (dates.length === 0) return;
    const idx = dates.indexOf(dateFilter);
    if (idx === -1) {
      // The active date (usually "today") has no bookings, so it isn't in
      // `dates` at all — jump to the nearest date that does instead of
      // silently doing nothing.
      const candidates =
        dir === 1
          ? dates.filter((d) => d > dateFilter)
          : [...dates].filter((d) => d < dateFilter).reverse();
      if (candidates[0]) setDateFilter(candidates[0]);
      return;
    }
    const next = dates[idx + dir];
    if (next) setDateFilter(next);
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    const service = services.find((s) => s.id === newBooking.serviceId);
    if (!newBooking.customerName.trim() || !newBooking.customerPhone.trim()) {
      toast.error("Customer name and phone are required");
      return;
    }
    if (!service) {
      toast.error("Pick a service");
      return;
    }
    const staffMember = bookableBarbers.find((b) => b.id === newBooking.staffId);
    setCreating(true);
    const result = await createStaffBooking({
      branchId,
      name: newBooking.customerName,
      phone: newBooking.customerPhone,
      email: newBooking.customerEmail,
      serviceIds: [service.id],
      staffId: staffMember?.id ?? null,
      date: newBooking.date,
      time: newBooking.time,
      gracePeriodMins: opsRules.gracePeriodMins,
    }).catch(() => null);
    setCreating(false);
    if (!result?.ok) {
      toast.error("Couldn't book the appointment", {
        description: result?.error ?? "Check your connection and try again",
      });
      return;
    }
    addBooking(result.data.booking);
    toast.success("Appointment booked", {
      description: `${newBooking.customerName} · ${formatDate(newBooking.date)} at ${newBooking.time}`,
    });
    setCreateOpen(false);
    setNewBooking(emptyNewBooking());
  }

  return (
    <>
      {confirm.node}
      <Topbar
        title="Appointments"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Appointment
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Today", value: todayCount },
              { label: "Confirmed", value: confirmedCount },
              { label: "Total Bookings", value: bookings.length },
            ].map((tile) => (
              <div
                key={tile.label}
                className="card-surface flex flex-col items-center gap-0.5 py-4 text-center"
              >
                <p className="font-display text-2xl font-bold">{tile.value}</p>
                <p className="text-xs text-[var(--text-faint)]">{tile.label}</p>
              </div>
            ))}
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
              <option value="cancelled">Cancelled</option>
            </select>
            <PillTabs
              tabs={[
                { value: "list", label: "All Dates" },
                { value: "calendar", label: "By Day" },
              ]}
              value={viewMode}
              onChange={(v) => setViewMode(v as "list" | "calendar")}
              className="overflow-visible pb-0"
            />
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
            <div className="space-y-2.5">
              {filtered.map((booking, i) => (
                <motion.button
                  key={booking.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(booking)}
                  className={cn(
                    "card-surface flex w-full items-center gap-3 border-l-4 p-3.5 text-left",
                    BORDER_BY_STATUS[booking.status] ?? "border-l-[var(--border)]",
                  )}
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-display text-sm font-bold">{booking.time}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {booking.durationMins}m
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-[var(--border-subtle)] pl-3">
                    <p className="truncate text-sm font-semibold">{booking.customerName}</p>
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
              <div className="space-y-2">
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
                <Button
                  variant="ghost"
                  className="w-full text-[var(--text-muted)]"
                  onClick={() => handleCancelBooking(selected)}
                >
                  <Ban className="h-4 w-4" />
                  Cancel Appointment
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
            {selected.status === "cancelled" && (
              <p className="text-center text-sm text-[var(--text-muted)]">
                This appointment was cancelled.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Appointment"
        description="Book a slot for a phone-in or walk-up customer."
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bk-name">Customer Name</Label>
              <Input
                id="bk-name"
                value={newBooking.customerName}
                onChange={(e) =>
                  setNewBooking((f) => ({ ...f, customerName: e.target.value }))
                }
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <Label htmlFor="bk-phone">Phone</Label>
              <Input
                id="bk-phone"
                value={newBooking.customerPhone}
                onChange={(e) =>
                  setNewBooking((f) => ({ ...f, customerPhone: e.target.value }))
                }
                placeholder="+60 12-345 6789"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bk-email">Email (for the receipt)</Label>
            <Input
              id="bk-email"
              type="email"
              value={newBooking.customerEmail}
              onChange={(e) =>
                setNewBooking((f) => ({ ...f, customerEmail: e.target.value }))
              }
              placeholder="Ask the customer — optional"
            />
          </div>
          <div>
            <Label htmlFor="bk-service">Service</Label>
            <Select
              id="bk-service"
              value={newBooking.serviceId}
              onChange={(e) =>
                setNewBooking((f) => ({ ...f, serviceId: e.target.value }))
              }
              required
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMins} min
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="bk-staff">Barber</Label>
            <Select
              id="bk-staff"
              value={newBooking.staffId}
              onChange={(e) =>
                setNewBooking((f) => ({ ...f, staffId: e.target.value }))
              }
            >
              <option value="">Any Barber</option>
              {bookableBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="bk-date">Date</Label>
              <Input
                id="bk-date"
                type="date"
                min={todayIso()}
                value={newBooking.date}
                onChange={(e) =>
                  setNewBooking((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="bk-time">Time</Label>
              <Input
                id="bk-time"
                type="time"
                value={newBooking.time}
                onChange={(e) =>
                  setNewBooking((f) => ({ ...f, time: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={creating}>
            Book Appointment
          </Button>
        </form>
      </Modal>
    </>
  );
}
