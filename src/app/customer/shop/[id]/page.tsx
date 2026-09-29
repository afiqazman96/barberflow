"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Phone,
  Calendar,
  Ticket,
  Star,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { BranchQrPanel } from "@/components/domain/branch-qr";
import { TIME_SLOTS } from "@/lib/mock/data";
import { useAppStore } from "@/lib/store/app-store";
import { cn, initials } from "@/lib/utils";

/** Pastel icon-chip backgrounds, matching the ones used on stat tiles
 * elsewhere in the app — one hue per metric so a row of them reads as a
 * set. */
const CHIP_STYLES = {
  amber: "bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]",
  coral: "bg-[var(--chip-coral-bg)] text-[var(--chip-coral-fg)]",
  sky: "bg-[var(--chip-sky-bg)] text-[var(--chip-sky-fg)]",
} as const;

export default function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const branches = useAppStore((s) => s.branches);
  const staff = useAppStore((s) => s.staff);
  const branch = branches.find((b) => b.id === id);
  const staffStatuses = useAppStore((s) => s.staffStatuses);

  if (!branch) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--text-muted)]">Shop not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/customer/home">Back to Home</Link>
        </Button>
      </div>
    );
  }

  const barbers = staff.filter(
    (s) => s.role === "barber" && s.branchId === branch.id && s.active,
  );
  const availableBarbers = barbers.filter(
    (b) => staffStatuses[b.id] === "available",
  );
  const bookedSlots = TIME_SLOTS.filter((_, i) => i % 3 === 0).length;
  const openSlots = TIME_SLOTS.length - bookedSlots;

  return (
    <div className="space-y-6">
      <Link
        href="/customer/home"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" /> All Shops
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{branch.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-[var(--text-muted)]">
              <MapPin className="h-4 w-4" />
              {branch.address}, {branch.city}
            </p>
          </div>
          <StatusBadge status={branch.status} />
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        {[
          {
            icon: Users,
            label: "In Queue",
            value: branch.queueCount,
            chip: "amber" as const,
          },
          {
            icon: Clock,
            label: "Est. Wait",
            value: `${branch.avgWaitMins}m`,
            chip: "coral" as const,
          },
          {
            icon: Calendar,
            label: "Slots Today",
            value: openSlots,
            chip: "sky" as const,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-3 text-center">
            <div
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-xl",
                CHIP_STYLES[stat.chip],
              )}
            >
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="mt-1.5 font-display text-xl font-bold">
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              {stat.label}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Hours</span>
          <span className="font-medium">{branch.openHours}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Phone</span>
          <a
            href={`tel:${branch.phone}`}
            className="flex items-center gap-1 font-medium text-[var(--gold-soft)]"
          >
            <Phone className="h-3.5 w-3.5" />
            {branch.phone}
          </a>
        </div>
      </Card>

      <Card className="border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
        <div className="flex items-start gap-3">
          <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--gold-soft)]">
              Scan shop QR or tap Join Queue
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              At the counter, scan the branch QR code to open the walk-in form,
              or join the queue below.
            </p>
            <div className="mt-3">
              <BranchQrPanel branch={branch} compact />
            </div>
          </div>
        </div>
      </Card>

      <section>
        <CardHeader className="mb-2">
          <div>
            <CardTitle>Available Barbers</CardTitle>
            <CardDescription>
              {availableBarbers.length} of {barbers.length || branch.chairs}{" "}
              ready now
            </CardDescription>
          </div>
        </CardHeader>

        {barbers.length > 0 ? (
          <div className="space-y-2">
            {barbers.map((barber) => {
              const status = staffStatuses[barber.id] ?? barber.status;
              return (
                <Card key={barber.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 font-display text-sm font-semibold text-[var(--gold-soft)]">
                    {initials(barber.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{barber.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {barber.specialty}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={status} />
                    <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-faint)]">
                      <Star className="h-3 w-3 text-[var(--gold)]" />
                      {barber.rating}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-4 text-center text-sm text-[var(--text-muted)]">
            {branch.chairs} chairs · barbers assigned at opening
          </Card>
        )}
      </section>

      <section>
        <CardHeader className="mb-2">
          <div>
            <CardTitle>Booking Availability</CardTitle>
            <CardDescription>
              {openSlots} time slots open today
            </CardDescription>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.slice(0, 8).map((slot) => (
            <span
              key={slot}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-xs font-medium",
                slot.endsWith("30")
                  ? "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  : "border border-[var(--gold)]/25 bg-[var(--gold)]/10 text-[var(--gold-soft)]",
              )}
            >
              {slot}
            </span>
          ))}
          <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs text-[var(--text-faint)]">
            +{Math.max(0, openSlots - 8)} more
          </span>
        </div>
      </section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-20 -mx-4 mt-2 space-y-2 border-t border-[var(--border)] bg-[var(--bg)]/92 px-4 pb-3 pt-3 backdrop-blur-lg lg:bottom-4 lg:rounded-2xl lg:border">
        <Button asChild size="lg" className="w-full">
          <Link href={`/customer/queue?branch=${branch.id}`}>
            <Ticket className="h-4 w-4" />
            Join Queue
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link href={`/customer/booking?branch=${branch.id}`}>
            <Calendar className="h-4 w-4" />
            Book Appointment
          </Link>
        </Button>
      </div>
    </div>
  );
}
