"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, Search } from "lucide-react";
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
import type { Booking, QueueTicket } from "@/lib/types";
import { formatDate, todayIso } from "@/lib/utils";

function nextQueueNumber(queue: QueueTicket[]) {
  const nums = queue
    .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 15;
  return `A${String(max + 1).padStart(3, "0")}`;
}

export default function CashierAppointmentPage() {
  const bookings = useAppStore((s) => s.bookings);
  const queue = useAppStore((s) => s.queue);
  const updateBooking = useAppStore((s) => s.updateBooking);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Booking | null>(null);

  const today = todayIso();

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        !search ||
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        b.customerPhone.includes(search);
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookings, search, statusFilter]);

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
                <p className="font-display text-xl font-semibold">
                  {confirmedCount}
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <div>
                <p className="text-xs text-[var(--text-faint)]">Date</p>
                <p className="font-display text-xl font-semibold">
                  {formatDate(today)}
                </p>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
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
              <option value="in-service">In Service</option>
              <option value="completed">Completed</option>
              <option value="no-show">No Show</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((booking, i) => (
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

          {filtered.length === 0 && (
            <Card className="py-12 text-center text-[var(--text-muted)]">
              No appointments match your search.
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
