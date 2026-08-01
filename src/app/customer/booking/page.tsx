"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Scissors,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { BRANCHES, SERVICES, STAFF, TIME_SLOTS } from "@/lib/mock/data";
import { useAppStore } from "@/lib/store/app-store";
import type { Booking } from "@/lib/types";
import { cn, formatCurrency, formatDate, initials } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Details", "Date & Time", "Service", "Barber", "Confirm"];

function getNextDays(count: number) {
  const days: { iso: string; label: string; weekday: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(d),
      weekday: d.toLocaleDateString("en-MY", { weekday: "short" }),
    });
  }
  return days;
}

function BookingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const branchId = params.get("branch") ?? "b1";

  const addBooking = useAppStore((s) => s.addBooking);
  const setTrackingTicketId = useAppStore((s) => s.setTrackingTicketId);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);
  const queue = useAppStore((s) => s.queue);

  const branch = BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0];
  const barbers = STAFF.filter(
    (s) => s.role === "barber" && s.branchId === branch.id,
  );
  const days = useMemo(() => getNextDays(7), []);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(days[0]?.iso ?? "");
  const [time, setTime] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [barberMode, setBarberMode] = useState<"any" | "preferred">("any");
  const [preferredStaffId, setPreferredStaffId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const service = SERVICES.find((s) => s.id === serviceId);
  const staff =
    barberMode === "preferred" && preferredStaffId
      ? STAFF.find((s) => s.id === preferredStaffId)
      : null;

  const takenSlots = useMemo(() => {
    const seed = date.split("-").reduce((a, b) => a + parseInt(b, 10), 0);
    return TIME_SLOTS.filter((_, i) => (seed + i) % 4 === 0);
  }, [date]);

  function canProceed() {
    if (step === 0) return name.trim().length >= 2 && phone.trim().length >= 8;
    if (step === 1) return date && time;
    if (step === 2) return !!serviceId;
    if (step === 3) {
      if (barberMode === "preferred" && barbers.length > 0) {
        return preferredStaffId !== null;
      }
      return true;
    }
    return true;
  }

  function handleConfirm() {
    if (!service) return;

    const booking: Booking = {
      id: `bk-${Date.now()}`,
      branchId: branch.id,
      customerId: "guest",
      customerName: name.trim(),
      customerPhone: phone.trim(),
      serviceIds: [service.id],
      serviceNames: [service.name],
      staffId: staff?.id ?? null,
      staffName: staff?.name ?? "Any Barber",
      date,
      time,
      durationMins: service.durationMins,
      gracePeriodMins: 10,
      status: "confirmed",
    };

    addBooking(booking);

    const nums = queue
      .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
      .filter((n) => !Number.isNaN(n));
    const number = `A${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0")}`;

    const ticketId = `q-bk-${Date.now()}`;
    addQueueTicket({
      id: ticketId,
      number,
      branchId: branch.id,
      customerId: "guest",
      customerName: name.trim(),
      customerPhone: phone.trim(),
      serviceIds: [service.id],
      serviceNames: [service.name],
      preferredStaffId: staff?.id ?? null,
      assignedStaffId: null,
      chairId: null,
      status: "waiting",
      estimatedWaitMins: 0,
      createdAt: new Date().toISOString(),
      source: "booking",
    });
    setTrackingTicketId(ticketId);

    toast.success("Booking confirmed!", {
      description: `${formatDate(date)} at ${time} · ${branch.name}`,
    });
    setConfirmed(true);
  }

  if (confirmed && service) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6 py-4 text-center"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/15">
          <Check className="h-8 w-8 text-[var(--success)]" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">You&apos;re Booked!</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {service.name} · {formatDate(date)} at {time}
          </p>
        </div>
        <Card className="p-4 text-left text-sm">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Location</span>
              <span>{branch.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Barber</span>
              <span>{staff?.name ?? "Any Barber"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total</span>
              <span className="font-semibold text-[var(--gold-soft)]">
                {formatCurrency(service.price)}
              </span>
            </div>
          </div>
        </Card>
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => router.push("/customer/tracking")}>
            Track Appointment
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/customer/home">Back to Home</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/customer/shop/${branch.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" /> {branch.name}
      </Link>

      <div>
        <h1 className="font-display text-xl font-bold">Book Appointment</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Reserve your slot · 10 min grace period
        </p>
      </div>

      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              i <= step ? "bg-[var(--gold)]" : "bg-[var(--bg-muted)]",
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="bk-name">Your Name</Label>
                <Input
                  id="bk-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label htmlFor="bk-phone">Mobile Number</Label>
                <Input
                  id="bk-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+60 12-345 6789"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map((d) => (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => {
                        setDate(d.iso);
                        setTime("");
                      }}
                      className={cn(
                        "shrink-0 rounded-xl border px-3 py-2 text-center transition",
                        date === d.iso
                          ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                          : "border-[var(--border)] hover:border-[var(--gold-dim)]",
                      )}
                    >
                      <p className="text-[10px] uppercase text-[var(--text-faint)]">
                        {d.weekday}
                      </p>
                      <p className="text-sm font-medium">{d.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Time</Label>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const taken = takenSlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={taken}
                        onClick={() => setTime(slot)}
                        className={cn(
                          "rounded-lg py-2 text-xs font-medium transition",
                          taken && "cursor-not-allowed opacity-30 line-through",
                          time === slot
                            ? "bg-[var(--gold)] text-[#0c0b09]"
                            : "bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)]",
                        )}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {SERVICES.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => setServiceId(svc.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    serviceId === svc.id
                      ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                      : "border-[var(--border)] hover:border-[var(--gold-dim)]",
                  )}
                >
                  <Scissors className="h-5 w-5 shrink-0 text-[var(--gold)]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{svc.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {svc.durationMins} min
                    </p>
                  </div>
                  <span className="font-semibold text-[var(--gold-soft)]">
                    {formatCurrency(svc.price)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBarberMode("any");
                    setPreferredStaffId(null);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    barberMode === "any"
                      ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                      : "border-[var(--border)]",
                  )}
                >
                  <Users className="mb-2 h-5 w-5 text-[var(--gold)]" />
                  <p className="font-medium">Any Barber</p>
                </button>
                <button
                  type="button"
                  onClick={() => setBarberMode("preferred")}
                  disabled={barbers.length === 0}
                  className={cn(
                    "rounded-xl border p-4 text-left transition disabled:opacity-40",
                    barberMode === "preferred"
                      ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                      : "border-[var(--border)]",
                  )}
                >
                  <User className="mb-2 h-5 w-5 text-[var(--gold)]" />
                  <p className="font-medium">Preferred</p>
                </button>
              </div>
              {barberMode === "preferred" &&
                barbers.map((barber) => (
                  <button
                    key={barber.id}
                    type="button"
                    onClick={() => setPreferredStaffId(barber.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left",
                      preferredStaffId === barber.id
                        ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                        : "border-[var(--border)]",
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold)]/20 font-display text-sm font-semibold text-[var(--gold-soft)]">
                      {initials(barber.name)}
                    </div>
                    <div>
                      <p className="font-medium">{barber.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {barber.specialty}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          )}

          {step === 4 && service && (
            <Card className="p-4">
              <CardHeader className="mb-3">
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--gold)]" />
                  <span>
                    {formatDate(date)} at {time}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-[var(--gold)]" />
                  <span>{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--gold)]" />
                  <span>{staff?.name ?? "Any Barber"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--gold)]" />
                  <span>{service.durationMins} min · {branch.name}</span>
                </div>
                <div className="border-t border-[var(--border)] pt-3 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-[var(--gold-soft)]">
                    {formatCurrency(service.price)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1"
            disabled={!canProceed()}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="flex-1" disabled={!canProceed()} onClick={handleConfirm}>
            Confirm Booking
          </Button>
        )}
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 py-8">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
      }
    >
      <BookingWizard />
    </Suspense>
  );
}
