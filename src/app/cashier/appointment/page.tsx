"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import type { Booking, QueueTicket } from "@/lib/types";
import { cn, formatWeekdayShort, todayIso } from "@/lib/utils";

function nextQueueNumber(queue: QueueTicket[]) {
  const nums = queue
    .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 15;
  return `A${String(max + 1).padStart(3, "0")}`;
}

/** 7 local dates, `before` days ahead of `after` days behind today. */
function weekAround(before: number, after: number) {
  const out: { iso: string; day: number }[] = [];
  const now = new Date();
  for (let i = -before; i <= after; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const p = (n: number) => String(n).padStart(2, "0");
    out.push({ iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, day: d.getDate() });
  }
  return out;
}

const BORDER_BY_STATUS: Record<string, string> = {
  confirmed: "border-l-[var(--info)]",
  "checked-in": "border-l-[var(--warning)]",
  "in-service": "border-l-[var(--warning)]",
  completed: "border-l-[var(--success)]",
  "no-show": "border-l-[var(--danger)]",
  cancelled: "border-l-[var(--danger)]",
};

export default function CashierAppointmentPage() {
  const bookings = useAppStore((s) => s.bookings);
  const queue = useAppStore((s) => s.queue);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selected, setSelected] = useState<Booking | null>(null);

  const today = todayIso();
  const week = useMemo(() => weekAround(3, 3), []);

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        const matchDate = b.date === selectedDate;
        const matchSearch =
          !search ||
          b.customerName.toLowerCase().includes(search.toLowerCase()) ||
          b.customerPhone.includes(search);
        const matchStatus = statusFilter === "all" || b.status === statusFilter;
        return matchDate && matchSearch && matchStatus;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings, search, statusFilter, selectedDate]);

  const todayCount = bookings.filter((b) => b.date === today).length;
  const confirmedCount = bookings.filter(
    (b) => b.date === today && b.status === "confirmed",
  ).length;

  function handleCheckIn(booking: Booking) {
    updateBooking(booking.id, { status: "checked-in" });

    const ticket: QueueTicket = {
      id: `q-bk-${Date.now()}`,
      number: nextQueueNumber(queue),
      branchId: booking.branchId,
      customerId: booking.customerId,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      bookingId: booking.id,
      serviceIds: booking.serviceIds,
      serviceNames: booking.serviceNames,
      preferredStaffId: booking.staffId,
      assignedStaffId: null,
      chairId: null,
      status: "waiting",
      estimatedWaitMins: 10,
      createdAt: new Date().toISOString(),
      source: "booking",
    };

    addQueueTicket(ticket);
    toast.success("Checked in", {
      description: `${booking.customerName} · Queue ${ticket.number}`,
    });
    setSelected(null);
  }

  return (
    <>
      <Topbar
        title="Appointments"
        actions={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg)]"
            aria-label="New appointment"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Today", value: todayCount },
              { label: "Confirmed", value: confirmedCount },
              { label: "Total", value: bookings.length },
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

          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {week.map((d) => {
              const active = d.iso === selectedDate;
              return (
                <button
                  key={d.iso}
                  onClick={() => setSelectedDate(d.iso)}
                  className={cn(
                    "flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3.5 py-2 text-xs font-medium transition",
                    active
                      ? "bg-[var(--text)] text-[var(--bg)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]",
                  )}
                >
                  <span className={active ? "opacity-70" : "text-[var(--text-faint)]"}>
                    {formatWeekdayShort(d.iso)}
                  </span>
                  <span className="font-display text-sm font-bold">{d.day}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                className="pl-10"
                placeholder="Name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition",
                showFilter || statusFilter !== "all"
                  ? "bg-[var(--gold)]/15 text-[var(--gold-soft)]"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)]",
              )}
              aria-label="Filter by status"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          {showFilter && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="in-service">In Service</option>
              <option value="completed">Completed</option>
              <option value="no-show">No Show</option>
            </select>
          )}

          <div className="space-y-2.5">
            {filtered.map((booking, i) => {
              const struck = booking.status === "no-show" || booking.status === "cancelled";
              return (
                <motion.button
                  key={booking.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
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
                    <p className={cn("truncate text-sm font-semibold", struck && "line-through opacity-60")}>
                      {booking.customerName}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {booking.serviceNames.join(" · ")} · {booking.staffName || "Any barber"}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </motion.button>
              );
            })}

            {filtered.length === 0 && (
              <div className="card-surface flex flex-col items-center gap-2 border-dashed py-10 text-center text-sm text-[var(--text-muted)]">
                No appointments for this day.
              </div>
            )}
          </div>
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
              {selected.notes && (
                <p className="rounded-lg bg-[var(--bg-muted)] p-3 text-xs">
                  {selected.notes}
                </p>
              )}
            </div>
            {selected.status === "confirmed" && (
              <Button className="w-full" size="lg" onClick={() => handleCheckIn(selected)}>
                <CheckCircle className="h-4 w-4" />
                Check In & Add to Queue
              </Button>
            )}
            {selected.status === "checked-in" && (
              <p className="text-center text-sm text-[var(--success)]">
                Already checked in — customer is in queue.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
