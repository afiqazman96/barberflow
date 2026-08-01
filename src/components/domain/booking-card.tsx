"use client";

import { Calendar, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import type { Booking } from "@/lib/types";

export function BookingCard({
  booking,
  onClick,
}: {
  booking: Booking;
  onClick?: () => void;
}) {
  return (
    <Card className="cursor-pointer p-4" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{booking.customerName}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {booking.serviceNames.join(" · ")}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-faint)]">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {booking.date}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {booking.time} · {booking.durationMins}m
        </span>
        <span>{booking.staffName}</span>
      </div>
    </Card>
  );
}
