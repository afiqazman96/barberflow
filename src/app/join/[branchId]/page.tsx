"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarClock, Clock, QrCode, Scissors, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";

/**
 * QR deep link. The customer has scanned the shop code — let them choose
 * between joining the walk-in queue now or booking a later slot, rather
 * than assuming a walk-in.
 */
export default function JoinBranchPage() {
  const params = useParams<{ branchId: string }>();
  const branches = useAppStore((s) => s.branches);
  const setBranchId = useAppStore((s) => s.setBranchId);
  const branch = branches.find((b) => b.id === params.branchId) ?? branches[0];

  useEffect(() => {
    if (branch) setBranchId(branch.id);
  }, [branch, setBranchId]);

  return (
    <div className="app-bg flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient">
          <Scissors className="h-8 w-8 text-[#0c0b09]" />
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          BarberFlow
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {branch?.name ?? "Opening…"}
        </h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
          <QrCode className="h-4 w-4 text-[var(--gold)]" />
          Checked in by QR
        </p>

        {branch && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[var(--text-faint)]">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {branch.queueCount} in queue
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> ~{branch.avgWaitMins} min wait
            </span>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Button asChild size="xl" className="w-full">
            <Link href={`/customer/queue?branch=${branch?.id ?? "b1"}&source=qr`}>
              <Ticket className="h-5 w-5" />
              Join the walk-in queue
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full">
            <Link href={`/customer/booking?branch=${branch?.id ?? "b1"}`}>
              <CalendarClock className="h-5 w-5" />
              Book a later appointment
            </Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-[var(--text-faint)]">
          Walk-in keeps your spot in today&apos;s line. Booking reserves a set
          time with a 10-minute grace period.
        </p>
      </div>
    </div>
  );
}
