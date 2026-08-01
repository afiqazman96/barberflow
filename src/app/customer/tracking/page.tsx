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
import { BRANCHES, STAFF } from "@/lib/mock/data";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export default function TrackingPage() {
  const queue = useAppStore((s) => s.queue);
  const trackingTicketId = useAppStore((s) => s.trackingTicketId);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);

  const [pulse, setPulse] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const ticket = useMemo(() => {
    if (trackingTicketId) {
      const t = queue.find((q) => q.id === trackingTicketId);
      if (t) return t;
    }
    return queue.find((q) => q.status === "waiting") ?? null;
  }, [queue, trackingTicketId]);

  const branch = ticket ? BRANCHES.find((b) => b.id === ticket.branchId) : null;

  const position = useMemo(() => {
    if (!ticket) return 0;
    const waiting = queue.filter(
      (q) =>
        q.branchId === ticket.branchId &&
        q.status === "waiting" &&
        new Date(q.createdAt) <= new Date(ticket.createdAt),
    );
    return waiting.findIndex((q) => q.id === ticket.id) + 1;
  }, [queue, ticket]);

  const staffName = ticket?.preferredStaffId
    ? STAFF.find((s) => s.id === ticket.preferredStaffId)?.name
    : null;

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p);
      setLastUpdated(new Date());

      if (ticket && ticket.status === "waiting" && ticket.estimatedWaitMins > 0) {
        const delta = Math.random() > 0.7 ? -1 : 0;
        if (delta !== 0) {
          updateQueueTicket(ticket.id, {
            estimatedWaitMins: Math.max(0, ticket.estimatedWaitMins + delta),
          });
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [ticket, updateQueueTicket]);

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

  const isActive =
    ticket.status === "waiting" ||
    ticket.status === "called" ||
    ticket.status === "in-service";

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
              {ticket.estimatedWaitMins > 0 ? (
                <>
                  {ticket.estimatedWaitMins}
                  <span className="text-sm font-normal text-[var(--text-muted)]">
                    m
                  </span>
                </>
              ) : (
                "Now"
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {isActive && (
        <div className="flex gap-1 px-8">
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
          Stay nearby — we&apos;ll notify you when it&apos;s almost your turn
        </p>
      )}

      {ticket.status === "completed" && (
        <Button asChild className="w-full" size="lg">
          <Link href="/customer/home">Done · Back to Home</Link>
        </Button>
      )}
    </div>
  );
}
