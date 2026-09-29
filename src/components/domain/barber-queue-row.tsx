"use client";

import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, initials } from "@/lib/utils";
import type { QueueTicket, StaffMember, StaffStatus } from "@/lib/types";

/**
 * One barber's row on the cashier's Queue Monitor: who they are, what's
 * happening with them right now, and — when they're free — one tap to call
 * the customer who's next for them.
 */
export function BarberQueueRow({
  staff,
  status,
  chairLabel,
  ticket,
  elapsedMins,
  durationMins,
  nextTicket,
  onCall,
}: {
  staff: StaffMember;
  status: StaffStatus;
  chairLabel?: string;
  /** The ticket they're currently serving, when busy. */
  ticket?: QueueTicket;
  elapsedMins?: number;
  durationMins?: number;
  /** The ticket that would be called next for this barber, when free. */
  nextTicket?: QueueTicket;
  onCall?: (ticket: QueueTicket) => void;
}) {
  const progress =
    elapsedMins !== undefined && durationMins
      ? Math.min(100, Math.round((elapsedMins / durationMins) * 100))
      : 0;

  return (
    <div className="card-surface flex items-center gap-3 p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 text-sm font-semibold text-[var(--gold-soft)]">
        {initials(staff.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{staff.name}</p>
        {status === "busy" && ticket ? (
          <>
            <p className="truncate text-xs text-[var(--text-muted)]">
              Serving {ticket.number} {ticket.customerName} ·{" "}
              {elapsedMins ?? 0}/{durationMins ?? 0} min
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div
                className="h-full rounded-full bg-[var(--gold)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <p className="truncate text-xs text-[var(--text-muted)]">
            {chairLabel ?? "Unassigned"}
            {staff.specialty ? ` · ${staff.specialty}` : ""}
          </p>
        )}
      </div>
      {status === "busy" && <Badge variant="warning">Busy</Badge>}
      {status === "break" && <Badge>On break</Badge>}
      {status === "available" &&
        (nextTicket ? (
          <button
            type="button"
            onClick={() => onCall?.(nextTicket)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--success)] px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-105",
            )}
          >
            <Phone className="h-3.5 w-3.5" />
            Call {nextTicket.number}
          </button>
        ) : (
          <Badge variant="success">Available</Badge>
        ))}
    </div>
  );
}
