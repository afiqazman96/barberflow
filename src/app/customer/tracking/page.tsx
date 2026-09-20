"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Ticket,
  Clock,
  Users,
  MapPin,
  RefreshCw,
  Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import { byQueueOrder, cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function TrackingPage() {
  const queue = useAppStore((s) => s.queue);
  const opsRules = useAppStore((s) => s.opsRules);
  const bookings = useAppStore((s) => s.bookings);
  const branches = useAppStore((s) => s.branches);
  const staffList = useAppStore((s) => s.staff);
  const chairs = useAppStore((s) => s.chairs);
  const trackingTicketId = useAppStore((s) => s.trackingTicketId);
  const trackingBookingId = useAppStore((s) => s.trackingBookingId);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);
  const updateBooking = useAppStore((s) => s.updateBooking);

  const [pulse, setPulse] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Only ever show the visitor their own ticket — never fall back to some
  // other customer's live entry. A booked customer gets a ticket only when
  // the counter checks them in, so follow the booking to it.
  const booking = useMemo(
    () =>
      trackingBookingId
        ? (bookings.find((b) => b.id === trackingBookingId) ?? null)
        : null,
    [bookings, trackingBookingId],
  );
  const ticket = useMemo(() => {
    if (trackingTicketId) {
      const own = queue.find((q) => q.id === trackingTicketId);
      if (own) return own;
    }
    if (booking) return queue.find((q) => q.bookingId === booking.id) ?? null;
    return null;
  }, [queue, trackingTicketId, booking]);

  const branch = branches.find(
    (b) => b.id === (ticket?.branchId ?? booking?.branchId),
  );

  // Oldest first: position is how many people are ahead, plus you.
  const position = useMemo(() => {
    if (!ticket) return 0;
    const line = queue
      .filter(
        (q) =>
          q.branchId === ticket.branchId &&
          q.status === "waiting",
      )
      .sort(byQueueOrder);
    return line.findIndex((q) => q.id === ticket.id) + 1;
  }, [queue, ticket]);

  const staffName = ticket?.preferredStaffId
    ? staffList.find((s) => s.id === ticket.preferredStaffId)?.name
    : null;
  const servedBy = ticket?.assignedStaffId
    ? staffList.find((s) => s.id === ticket.assignedStaffId)?.name
    : null;
  const chairLabel = ticket?.chairId
    ? chairs.find((c) => c.id === ticket.chairId)?.label
    : null;

  // Counts down from the estimate given when they joined — no fake ticking.
  const waitLeft = ticket
    ? Math.max(
        0,
        ticket.estimatedWaitMins -
          Math.floor(
            (lastUpdated.getTime() - new Date(ticket.createdAt).getTime()) / 60000,
          ),
      )
    : 0;

  function handleLeave() {
    if (!ticket) return;
    updateQueueTicket(ticket.id, { status: "cancelled" });
    setLeaveOpen(false);
    toast.success("You've left the queue", {
      description: `Ticket ${ticket.number} cancelled`,
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p);
      setLastUpdated(new Date());
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  function handleCancelBooking() {
    if (!booking) return;
    const startsAt = new Date(`${booking.date}T${booking.time}:00`).getTime();
    if (startsAt - Date.now() < opsRules.cancelHours * 3600_000) {
      toast.error(`Too late to cancel online`, {
        description: `Cancellations close ${opsRules.cancelHours}h before the appointment — please call ${branch?.phone ?? "the shop"}`,
      });
      return;
    }
    updateBooking(booking.id, { status: "cancelled" });
    toast.success("Appointment cancelled", {
      description: `${formatDate(booking.date)} at ${booking.time}`,
    });
  }

  if (!ticket && booking) {
    const done = booking.status !== "confirmed";
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold">Your Appointment</h1>
          <p className="text-xs text-[var(--text-faint)]">{branch?.name}</p>
        </div>
        <Card className="space-y-3 p-5 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-display text-2xl font-bold">
              {formatDate(booking.date)}
            </p>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-lg font-semibold text-[var(--gold-soft)]">
            {booking.time}
          </p>
          <div className="space-y-1 border-t border-[var(--border)] pt-3">
            <p className="font-medium">{booking.serviceNames.join(" · ")}</p>
            <p className="text-[var(--text-muted)]">
              with {booking.staffName} · {booking.gracePeriodMins} min grace period
            </p>
          </div>
        </Card>
        {booking.status === "confirmed" && (
          <>
            <p className="text-center text-xs text-[var(--text-faint)]">
              Arrive a few minutes early and check in at the counter — you&apos;ll
              get your queue number then.
            </p>
            <Button
              variant="outline"
              className="w-full text-[var(--danger)]"
              onClick={handleCancelBooking}
            >
              Cancel appointment
            </Button>
          </>
        )}
        {done && (
          <p className="text-center text-sm text-[var(--text-muted)]">
            {booking.status === "cancelled"
              ? "This appointment was cancelled."
              : booking.status === "no-show"
                ? "This appointment was marked as a no-show."
                : "This appointment is complete."}
          </p>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link href="/customer/home">Back to Home</Link>
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
          <Ticket className="h-8 w-8 text-[var(--text-faint)]" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">No Active Ticket</h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
          Join the walk-in queue or book an appointment to track your wait time
          live.
        </p>
        <div className="mt-6 w-full space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/customer/queue?branch=b1">Join Queue</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/customer/booking?branch=b1">Book Appointment</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (ticket.status === "cancelled") {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
          <Ticket className="h-8 w-8 text-[var(--text-faint)]" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold">
          You&apos;ve left the queue
        </h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
          Ticket {ticket.number} was cancelled. Rejoin any time to get a new
          number.
        </p>
        <div className="mt-6 w-full space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link href={`/customer/queue?branch=${ticket.branchId}`}>
              Rejoin Queue
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/customer/home">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isActive =
    ticket.status === "waiting" ||
    ticket.status === "called" ||
    ticket.status === "in-service";
  const canLeave =
    ticket.status === "waiting" || ticket.status === "called";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Queue Tracking</h1>
          <p className="text-xs text-[var(--text-faint)]">
            Updated {lastUpdated.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <motion.div
          animate={{ rotate: pulse ? 180 : 0 }}
          transition={{ duration: 0.5 }}
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              isActive ? "text-[var(--gold)]" : "text-[var(--text-faint)]",
            )}
          />
        </motion.div>
      </div>

      <motion.div
        animate={
          isActive
            ? { boxShadow: pulse ? "0 0 24px rgba(201,162,39,0.2)" : "0 0 0px rgba(201,162,39,0)" }
            : {}
        }
        transition={{ duration: 2 }}
        className={cn(
          "card-surface overflow-hidden text-center",
          ticket.status === "in-service" && "pulse-gold",
        )}
      >
        <div className="bg-[var(--gold)]/5 px-4 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">
            Your Number
          </p>
          <motion.p
            key={ticket.number}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-2 font-display text-6xl font-bold gold-text"
          >
            {ticket.number}
          </motion.p>
          <div className="mt-4 flex justify-center">
            <StatusBadge status={ticket.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[var(--border)] border-t border-[var(--border)]">
          <div className="px-4 py-5">
            <Users className="mx-auto h-4 w-4 text-[var(--gold)]" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Position
            </p>
            <p className="font-display text-2xl font-bold">
              {ticket.status === "waiting" ? position : "—"}
            </p>
          </div>
          <div className="px-4 py-5">
            <Clock className="mx-auto h-4 w-4 text-[var(--gold)]" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Est. Wait
            </p>
            <p className="font-display text-2xl font-bold text-[var(--gold-soft)]">
              {ticket.status !== "waiting" ? (
                "Now"
              ) : waitLeft > 0 ? (
                <>
                  {waitLeft}
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    m
                  </span>
                </>
              ) : (
                "Soon"
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {isActive && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-40 gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-1 flex-1 rounded-full bg-[var(--gold)]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            Live · updates automatically
          </p>
        </div>
      )}

      <Card className="space-y-3 p-4 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
          <div>
            <p className="font-medium">{branch?.name ?? "Fade House"}</p>
            <p className="text-xs text-[var(--text-muted)]">{branch?.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
          <div>
            <p className="font-medium">{ticket.serviceNames.join(" · ")}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {ticket.customerName} · {ticket.source === "booking" ? "Appointment" : "Walk-in"}
            </p>
          </div>
        </div>
        {staffName && (
          <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
            <span className="text-[var(--text-muted)]">Preferred barber</span>
            <span className="font-medium text-[var(--gold-soft)]">{staffName}</span>
          </div>
        )}
      </Card>

      {ticket.status === "waiting" && (
        <p className="text-center text-xs text-[var(--text-faint)]">
          Keep this screen open — your position updates on its own.
        </p>
      )}
      {ticket.status === "called" && (
        <p className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-3 text-center text-sm text-[var(--gold-soft)]">
          You&apos;re being called — please head to the counter now.
        </p>
      )}
      {ticket.status === "in-service" && (
        <p className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-3 text-center text-sm text-[var(--gold-soft)]">
          {servedBy ? `${servedBy} is with you` : "You're being served"}
          {chairLabel ? ` at ${chairLabel}` : ""}.
        </p>
      )}
      {ticket.status === "awaiting-payment" && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-center text-sm text-[var(--text-muted)]">
          All done — please pay at the counter.
          {ticket.customerEmail
            ? ` Your receipt will be emailed to ${ticket.customerEmail}.`
            : ""}
        </p>
      )}
      {ticket.status === "no-show" && (
        <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-center text-sm text-[var(--danger)]">
          You were marked as a no-show. Rejoin the queue any time for a new number.
        </p>
      )}

      {canLeave && (
        <Button
          variant="outline"
          className="w-full text-[var(--danger)]"
          onClick={() => setLeaveOpen(true)}
        >
          Leave queue
        </Button>
      )}

      {ticket.status === "completed" && ticket.customerEmail && (
        <p className="text-center text-sm text-[var(--text-muted)]">
          Thank you! Your receipt was emailed to {ticket.customerEmail}.
        </p>
      )}

      {ticket.status === "completed" && (
        <Button asChild className="w-full" size="lg">
          <Link href="/customer/home">Done · Back to Home</Link>
        </Button>
      )}

      <Modal
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave the queue?"
        description={`Ticket ${ticket.number} will be cancelled. You'd need to rejoin for a new number.`}
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setLeaveOpen(false)}
          >
            Stay in queue
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleLeave}>
            Leave queue
          </Button>
        </div>
      </Modal>
    </div>
  );
}
