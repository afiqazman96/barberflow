"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Scissors,
  User,
  Phone,
  Mail,
  Users,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import type { QueueTicket } from "@/lib/types";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Your details", "Services", "Barber"];

function nextQueueNumber(queue: QueueTicket[]): string {
  const nums = queue
    .map((q) => parseInt(q.number.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `A${String(max + 1).padStart(3, "0")}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8;
}

function QueueWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const branchIdParam = params.get("branch") ?? "b1";
  const fromQr = params.get("source") === "qr";

  const queue = useAppStore((s) => s.queue);
  const branches = useAppStore((s) => s.branches);
  const services = useAppStore((s) => s.services);
  const staff = useAppStore((s) => s.staff);
  const addQueueTicket = useAppStore((s) => s.addQueueTicket);
  const setTrackingTicketId = useAppStore((s) => s.setTrackingTicketId);
  const setBranchId = useAppStore((s) => s.setBranchId);

  const branch = branches.find((b) => b.id === branchIdParam) ?? branches[0];
  const barbers = staff.filter(
    (s) => s.role === "barber" && s.branchId === branch.id,
  );

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [contactMode, setContactMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberMode, setBarberMode] = useState<"any" | "preferred">("any");
  const [preferredStaffId, setPreferredStaffId] = useState<string | null>(null);

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [serviceIds, services],
  );

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + s.durationMins,
    0,
  );
  // One estimate, used in the summary and written onto the ticket, so the
  // number the customer sees here matches the one on the tracking screen.
  const estWaitMins = branch.avgWaitMins + Math.min(serviceIds.length * 4, 16);

  const contactOk =
    contactMode === "phone" ? isValidPhone(phone) : isValidEmail(email);

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function canProceed() {
    if (step === 0) return name.trim().length >= 2 && contactOk;
    if (step === 1) return serviceIds.length > 0;
    if (step === 2) {
      if (barberMode === "preferred" && barbers.length > 0) {
        return preferredStaffId !== null;
      }
      return true;
    }
    return false;
  }

  function handleSubmit() {
    if (!contactOk) {
      toast.error("Phone number or email is required");
      return;
    }

    const number = nextQueueNumber(queue);
    const ticket: QueueTicket = {
      id: `q-${Date.now()}`,
      number,
      branchId: branch.id,
      customerId: "guest",
      customerName: name.trim(),
      customerPhone: contactMode === "phone" ? phone.trim() : "",
      customerEmail: contactMode === "email" ? email.trim() : undefined,
      serviceIds,
      serviceNames: selectedServices.map((s) => s.name),
      preferredStaffId: barberMode === "preferred" ? preferredStaffId : null,
      assignedStaffId: null,
      chairId: null,
      status: "waiting",
      estimatedWaitMins: estWaitMins,
      createdAt: new Date().toISOString(),
      source: "qr",
    };

    addQueueTicket(ticket);
    setTrackingTicketId(ticket.id);
    setBranchId(branch.id);
    toast.success("You're in the queue!", {
      description: `Ticket ${number} · ~${ticket.estimatedWaitMins} min wait`,
    });
    router.push("/customer/tracking");
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
        <div className="mb-1 flex items-center gap-2">
          {fromQr && <QrCode className="h-4 w-4 text-[var(--gold)]" />}
          <h1 className="font-display text-xl font-bold">Join Queue</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          {fromQr
            ? "Welcome — enter your details to get a queue number"
            : "Walk-in · get your number in seconds"}
        </p>
      </div>

      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "h-1 flex-1 rounded-full transition",
              i <= step ? "bg-[var(--gold)]" : "bg-[var(--bg-muted)]",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Ahmad Ibrahim"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <Label>Contact (required)</Label>
                <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-muted)] p-1">
                  <button
                    type="button"
                    onClick={() => setContactMode("phone")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
                      contactMode === "phone"
                        ? "bg-[var(--bg-card)] text-[var(--gold-soft)]"
                        : "text-[var(--text-faint)]",
                    )}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMode("email")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
                      contactMode === "email"
                        ? "bg-[var(--bg-card)] text-[var(--gold-soft)]"
                        : "text-[var(--text-faint)]",
                    )}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </button>
                </div>
                {contactMode === "phone" ? (
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+60 12-345 6789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                ) : (
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
                <p className="mt-2 text-xs text-[var(--text-faint)]">
                  A phone number or email is required so the shop can reach you.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Select one or more services
              </p>
              {services.map((service) => {
                const selected = serviceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                        : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--gold-dim)]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        selected
                          ? "bg-[var(--gold)] text-[#0c0b09]"
                          : "bg-[var(--bg-muted)] text-[var(--text-muted)]",
                      )}
                    >
                      {selected ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Scissors className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {service.durationMins} min · {service.category}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-[var(--gold-soft)]">
                      {formatCurrency(service.price)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
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
                      : "border-[var(--border)] hover:border-[var(--gold-dim)]",
                  )}
                >
                  <Users className="mb-2 h-5 w-5 text-[var(--gold)]" />
                  <p className="font-medium">Any Barber</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Fastest available
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setBarberMode("preferred")}
                  disabled={barbers.length === 0}
                  className={cn(
                    "rounded-xl border p-4 text-left transition disabled:opacity-40",
                    barberMode === "preferred"
                      ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                      : "border-[var(--border)] hover:border-[var(--gold-dim)]",
                  )}
                >
                  <User className="mb-2 h-5 w-5 text-[var(--gold)]" />
                  <p className="font-medium">Preferred</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Pick your barber
                  </p>
                </button>
              </div>

              {barberMode === "preferred" && barbers.length > 0 && (
                <div className="space-y-2">
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setPreferredStaffId(barber.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                        preferredStaffId === barber.id
                          ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                          : "border-[var(--border)] hover:border-[var(--gold-dim)]",
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

              <Card className="space-y-2 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Name</span>
                  <span className="text-right">{name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Contact</span>
                  <span className="text-right">
                    {contactMode === "phone" ? phone : email}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Services</span>
                  <span className="text-right">
                    {selectedServices.map((s) => s.name).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--text-muted)]">Total</span>
                  <span className="text-right">
                    {formatCurrency(totalPrice)} · {totalDuration} min
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-2">
                  <span className="text-[var(--text-muted)]">Est. wait</span>
                  <span className="font-semibold text-[var(--gold-soft)]">
                    ~{estWaitMins} min
                  </span>
                </div>
              </Card>
            </div>
          )}
      </motion.div>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-20 -mx-4 mt-2 border-t border-[var(--border)] bg-[var(--bg)]/92 px-4 pb-3 pt-3 backdrop-blur-lg lg:bottom-4 lg:rounded-2xl lg:border">
        {step === 1 && (
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">
              {serviceIds.length} selected
            </span>
            <span className="font-semibold text-[var(--gold-soft)]">
              {formatCurrency(totalPrice)}
              {totalDuration > 0 && ` · ${totalDuration} min`}
            </span>
          </div>
        )}
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep((s) => s - 1)}
            >
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
            <Button
              className="flex-1"
              disabled={!canProceed()}
              onClick={handleSubmit}
            >
              Get Queue Number
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueuePage() {
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
      <QueueWizard />
    </Suspense>
  );
}
