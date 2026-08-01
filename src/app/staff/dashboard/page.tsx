"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Coffee,
  RotateCcw,
  Scissors,
  CheckCircle2,
  LogOut,
  Users,
  DollarSign,
  TrendingUp,
  Target,
  Armchair,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/domain/stat-card";
import { QueueCard } from "@/components/domain/queue-card";
import { findNextQueueTicket, useStaffPortal } from "@/hooks/use-staff-portal";
import { cn, formatCurrency } from "@/lib/utils";

export default function StaffDashboardPage() {
  const {
    staffId,
    staff,
    status,
    chair,
    chairs,
    currentTicket,
    queue,
    updateStaffStatus,
    updateQueueTicket,
    assignChair,
  } = useStaffPortal();

  const [chairModalOpen, setChairModalOpen] = useState(false);
  const [selectedChairId, setSelectedChairId] = useState<string | null>(
    chair?.id ?? staff?.chairId ?? null,
  );

  const targetPct = staff?.monthlyTarget
    ? Math.min(100, Math.round((staff.monthlySales / staff.monthlyTarget) * 100))
    : 0;

  const availableChairs = chairs.filter(
    (c) => c.staffId === null || c.staffId === staffId,
  );

  function handleStartShift() {
    setChairModalOpen(true);
  }

  function confirmStartShift() {
    if (!selectedChairId) {
      toast.error("Pick a chair to start your shift");
      return;
    }
    const picked = chairs.find((c) => c.id === selectedChairId);
    assignChair(selectedChairId, staffId);
    updateStaffStatus(staffId, "available");
    setChairModalOpen(false);
    toast.success("Shift started", {
      description: `You're available at ${picked?.label ?? "your chair"}`,
    });
  }

  function handleBreak() {
    updateStaffStatus(staffId, "break");
    toast.info("Break started", { description: "Queue paused for you" });
  }

  function handleResume() {
    updateStaffStatus(staffId, "available");
    toast.success("Back on floor", { description: "You're available again" });
  }

  function handleStartService() {
    if (currentTicket) {
      toast.error("Finish current service first");
      return;
    }
    const next = findNextQueueTicket(queue, staffId);
    if (!next) {
      toast.warning("No customers waiting", {
        description: "Check back when the queue fills up",
      });
      return;
    }
    updateQueueTicket(next.id, {
      assignedStaffId: staffId,
      chairId: selectedChairId ?? chair?.id ?? staff.chairId,
      status: "in-service",
      startedAt: new Date().toISOString(),
      estimatedWaitMins: 0,
    });
    updateStaffStatus(staffId, "busy");
    toast.success("Service started", {
      description: `${next.customerName} · ${next.number}`,
    });
  }

  function handleCompleteService() {
    if (!currentTicket) {
      toast.error("No active service");
      return;
    }
    updateQueueTicket(currentTicket.id, {
      status: "awaiting-payment",
      estimatedWaitMins: 0,
    });
    updateStaffStatus(staffId, "available");
    toast.success("Service complete", {
      description: `${currentTicket.customerName} sent to POS for payment`,
    });
  }

  function handleEndShift() {
    if (currentTicket) {
      toast.error("Complete your current service before ending shift");
      return;
    }
    updateStaffStatus(staffId, "off-duty");
    toast.success("Shift ended", { description: "See you next time" });
  }

  const isOffDuty = status === "off-duty";
  const isAvailable = status === "available";
  const isBusy = status === "busy";
  const isBreak = status === "break";

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
            Staff Portal
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
            Hey, {staff.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {staff.specialty}
          </p>
        </div>
        <StatusBadge status={status} />
      </motion.header>

      {isBusy && currentTicket && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Link href="/staff/current-service">
            <QueueCard ticket={currentTicket} active />
          </Link>
          <p className="mt-2 text-center text-xs text-[var(--text-faint)]">
            Tap for service details
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today's Customers"
          value={String(staff.todayCustomers)}
          icon={Users}
          delay={0.05}
        />
        <StatCard
          label="Today's Sales"
          value={formatCurrency(staff.todaySales)}
          icon={DollarSign}
          delay={0.1}
        />
        <StatCard
          label="Today's Commission"
          value={formatCurrency(staff.todayCommission)}
          change="+12% vs yesterday"
          trend="up"
          icon={TrendingUp}
          delay={0.15}
        />
        <StatCard
          label="Monthly Commission"
          value={formatCurrency(staff.monthlyCommission)}
          icon={Wallet}
          delay={0.2}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--gold)]" />
            Monthly Target
          </CardTitle>
          <span className="font-display text-sm font-semibold text-[var(--gold-soft)]">
            {targetPct}%
          </span>
        </CardHeader>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <motion.div
            className="h-full rounded-full gold-gradient"
            initial={{ width: 0 }}
            animate={{ width: `${targetPct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-[var(--text-muted)]">
          <span>{formatCurrency(staff.monthlySales)} sold</span>
          <span>Goal {formatCurrency(staff.monthlyTarget)}</span>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Shift Controls
        </h2>

        {isOffDuty && (
          <Button size="xl" className="w-full" onClick={handleStartShift}>
            <Play className="h-5 w-5" />
            Start Shift
          </Button>
        )}

        {isAvailable && (
          <>
            <Button size="xl" className="w-full" onClick={handleStartService}>
              <Scissors className="h-5 w-5" />
              Start Service
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="secondary" onClick={handleBreak}>
                <Coffee className="h-4 w-4" />
                Break
              </Button>
              <Button size="lg" variant="outline" onClick={handleEndShift}>
                <LogOut className="h-4 w-4" />
                End Shift
              </Button>
            </div>
          </>
        )}

        {isBusy && (
          <>
            <Button size="xl" className="w-full" onClick={handleCompleteService}>
              <CheckCircle2 className="h-5 w-5" />
              Complete Service
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/staff/current-service">
                <Scissors className="h-4 w-4" />
                View Current Service
              </Link>
            </Button>
          </>
        )}

        {isBreak && (
          <>
            <Button size="xl" className="w-full" onClick={handleResume}>
              <RotateCcw className="h-5 w-5" />
              Resume
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={handleEndShift}>
              <LogOut className="h-4 w-4" />
              End Shift
            </Button>
          </>
        )}
      </section>

      {isAvailable && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            Up Next
          </h2>
          {(() => {
            const next = findNextQueueTicket(queue, staffId);
            return next ? (
              <QueueCard ticket={next} />
            ) : (
              <Card className="py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">
                  Queue is clear — enjoy the breather
                </p>
              </Card>
            );
          })()}
        </section>
      )}

      <Modal
        open={chairModalOpen}
        onOpenChange={setChairModalOpen}
        title="Pick your chair"
        description="Select a station for this shift"
      >
        <div className="space-y-2">
          {availableChairs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedChairId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                selectedChairId === c.id
                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/10"
                  : "border-[var(--border)] bg-[var(--bg-muted)] hover:border-[var(--gold-dim)]",
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gold)]/15">
                <Armchair className="h-5 w-5 text-[var(--gold-soft)]" />
              </div>
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Chair {c.number}
                  {c.staffId === staffId && " · Your usual spot"}
                </p>
              </div>
            </button>
          ))}
        </div>
        <Button className="mt-5 w-full" size="lg" onClick={confirmStartShift}>
          Go Available
        </Button>
      </Modal>
    </div>
  );
}
