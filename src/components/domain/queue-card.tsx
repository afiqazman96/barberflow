"use client";

import { Clock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import type { QueueTicket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QueueCard({
  ticket,
  active,
  onClick,
}: {
  ticket: QueueTicket;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer p-4 transition-all",
        active && "border-[var(--gold)]/50 ring-1 ring-[var(--gold)]/30",
        ticket.status === "in-service" && "pulse-gold",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)]/15 font-display text-lg font-bold text-[var(--gold-soft)]">
            {ticket.number}
          </div>
          <div>
            <p className="font-medium">{ticket.customerName}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {ticket.serviceNames.join(" · ")}
            </p>
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-faint)]">
        <span className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          {ticket.preferredStaffId
            ? `Preferred · ${ticket.assignedStaffId ? "Assigned" : "Waiting"}`
            : "Any Barber"}
        </span>
        {ticket.estimatedWaitMins > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />~{ticket.estimatedWaitMins} min
          </span>
        )}
        <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 uppercase tracking-wide">
          {ticket.source}
        </span>
      </div>
    </Card>
  );
}
