"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Phone,
  Scissors,
  Send,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { SERVICES } from "@/lib/mock/data";
import { useStaffPortal } from "@/hooks/use-staff-portal";
import { formatCurrency, formatTime } from "@/lib/utils";

function useElapsedTimer(startedAt?: string) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function CurrentServicePage() {
  const {
    staffId,
    currentTicket,
    updateStaffStatus,
    updateQueueTicket,
  } = useStaffPortal();

  const timer = useElapsedTimer(currentTicket?.startedAt);

  const services = useMemo(() => {
    if (!currentTicket) return [];
    return currentTicket.serviceIds
      .map((id) => SERVICES.find((s) => s.id === id))
      .filter(Boolean);
  }, [currentTicket]);

  const totalDuration = services.reduce((sum, s) => sum + (s?.durationMins ?? 0), 0);
  const totalPrice = services.reduce((sum, s) => sum + (s?.price ?? 0), 0);

  function handleComplete() {
    if (!currentTicket) return;
    updateQueueTicket(currentTicket.id, {
      status: "awaiting-payment",
      estimatedWaitMins: 0,
    });
    updateStaffStatus(staffId, "available");
    toast.success("Sent to POS", {
      description: `${currentTicket.customerName} · ${formatCurrency(totalPrice)} ready to checkout`,
    });
  }

  if (!currentTicket) {
    return (
      <div className="space-y-6">
        <Link
          href="/staff/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <Card className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
            <Scissors className="h-8 w-8 text-[var(--text-faint)]" />
          </div>
          <h1 className="font-display text-xl font-bold">No active service</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Start a service from the dashboard when a customer is ready
          </p>
          <Button asChild className="mt-6" size="lg">
            <Link href="/staff/dashboard">Go to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/staff/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </Link>

      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
            In Service
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {currentTicket.customerName}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
            <Phone className="h-3.5 w-3.5" />
            {currentTicket.customerPhone}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status="in-service" />
          <span className="rounded-lg bg-[var(--gold)]/15 px-2.5 py-1 font-display text-lg font-bold text-[var(--gold-soft)]">
            {currentTicket.number}
          </span>
        </div>
      </motion.header>

      <Card className="pulse-gold overflow-hidden p-0">
        <div className="gold-gradient px-5 py-6 text-[#0c0b09]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide opacity-80">
                Elapsed
              </span>
            </div>
            <span className="font-display text-4xl font-bold tabular-nums tracking-tight">
              {timer}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm opacity-80">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Est. {totalDuration} min
            </span>
            {currentTicket.startedAt && (
              <span>Started {formatTime(currentTicket.startedAt)}</span>
            )}
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Services
        </h2>
        <div className="space-y-2">
          {services.map((service, i) => (
            <motion.div
              key={service!.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{service!.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {service!.category} · {service!.durationMins} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold text-[var(--gold-soft)]">
                    {formatCurrency(service!.price)}
                  </p>
                  {service!.popular && (
                    <Badge variant="gold" className="mt-1 text-[10px]">
                      Popular
                    </Badge>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <Card className="border-[var(--info)]/20 bg-[var(--info)]/5">
        <CardHeader className="mb-2">
          <CardTitle className="flex items-center gap-2 text-[var(--info)]">
            <Send className="h-4 w-4" />
            POS Handoff
          </CardTitle>
        </CardHeader>
        <p className="text-sm text-[var(--text-muted)]">
          When you complete this service, the ticket moves to{" "}
          <span className="font-medium text-[var(--text)]">awaiting payment</span>{" "}
          at the cashier POS. Add products or apply discounts there before checkout.
        </p>
        <p className="mt-2 font-display text-lg font-semibold">
          Total {formatCurrency(totalPrice)}
        </p>
      </Card>

      <Button size="xl" className="w-full" onClick={handleComplete}>
        <CheckCircle2 className="h-5 w-5" />
        Complete Service
      </Button>
    </div>
  );
}
