"use client";

import { useMemo, useState } from "react";
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
import { HeroStatCard } from "@/components/domain/hero-stat-card";
import { StatTile } from "@/components/domain/stat-tile";
import { QueueCard } from "@/components/domain/queue-card";
import { MyShiftCard } from "@/components/domain/shift-cards";
import { findNextQueueTicket, useStaffPortal } from "@/hooks/use-staff-portal";
import { useNow } from "@/hooks/use-now";
import { useAppStore } from "@/lib/store/app-store";
import { isRosteredOn, localIso } from "@/lib/roster";
import { weeklyTrend } from "@/lib/analytics";
import { cn, formatCurrency, formatDateCompact, todayIso } from "@/lib/utils";

/** "Good morning" / "Good afternoon" / "Good evening", by the visitor's clock. */
function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function StaffDashboardPage() {
  const {
    staffId,
    staff,
    status,
    chair,
    chairs,
    currentTicket,
    staffSales,
    queue,
    updateStaffStatus,
    updateQueueTicket,
  } = useStaffPortal();

  const startShift = useAppStore((s) => s.startShift);
  const endShift = useAppStore((s) => s.endShift);
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);
  const now = useNow();

  const [chairModalOpen, setChairModalOpen] = useState(false);
  const [selectedChairId, setSelectedChairId] = useState<string | null>(
    chair?.id ?? staff?.chairId ?? null,
  );

  const targetPct = staff?.monthlyTarget
    ? Math.min(100, Math.round((staff.monthlySales / staff.monthlyTarget) * 100))
    : 0;

  // Static "now" for display only (greeting, date pill, trend bucketing) —
  // mirrors the cashier dashboard's own approach rather than the live-ticking
  // clock used above for the stale-shift check.
  const nowStatic = useMemo(() => new Date(), []);
  const today = todayIso();
  const todaySalesList = useMemo(
    () => staffSales.filter((s) => !s.voided && s.createdAt.slice(0, 10) === today),
    [staffSales, today],
  );
  const trend = useMemo(() => weeklyTrend(staffSales, nowStatic), [staffSales, nowStatic]);

  const availableChairs = chairs.filter(
    (c) =>
      c.branchId === staff?.branchId &&
      (c.staffId === null || c.staffId === staffId),
  );

  function handleStartShift() {
    const today = localIso(now ?? new Date());
    if (!isRosteredOn(roster, leaves, staffId, today)) {
      toast.warning("You're not rostered today", {
        description: "Your owner will see this as an unscheduled shift",
      });
    }
    setChairModalOpen(true);
  }

  function confirmStartShift() {
    if (!selectedChairId) {
      toast.error("Pick a chair to start your shift");
      return;
    }
    const picked = chairs.find((c) => c.id === selectedChairId);
    const res = startShift(staffId, { chairId: selectedChairId });
    if (!res.ok) {
      toast.error("Couldn't start your shift", { description: res.error });
      return;
    }
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
    const next = findNextQueueTicket(queue, staffId, staff?.branchId);
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
    const res = endShift(staffId);
    if (!res.ok) {
      toast.error("Can't end your shift yet", { description: res.error });
      return;
    }
    toast.success("Shift ended", {
      description: "Your chair is free for the next barber",
    });
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
          <p className="text-sm text-[var(--text-muted)]">
            {greetingFor(nowStatic.getHours())},
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {staff.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {staff.specialty}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            {formatDateCompact(nowStatic)}
          </span>
          <StatusBadge status={status} />
        </div>
      </motion.header>

      <HeroStatCard
        label="Today's sales"
        value={formatCurrency(staff.todaySales)}
        pill={`${todaySalesList.length} sale${todaySalesList.length === 1 ? "" : "s"}`}
        bars={trend.map((t, i) => ({
          label: i === trend.length - 1 ? "Today" : t.day,
          value: t.sales,
        }))}
      />

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
        <StatTile
          icon={Users}
          chip="mint"
          value={String(staff.todayCustomers)}
          label="Today's customers"
          delay={0.05}
        />
        <StatTile
          icon={Wallet}
          chip="amber"
          value={formatCurrency(staff.todayCommission)}
          label="Today's commission"
          delay={0.1}
        />
        <StatTile
          icon={TrendingUp}
          chip="sky"
          value={formatCurrency(staff.monthlyCommission)}
          label="Monthly commission"
          delay={0.15}
        />
        <StatTile
          icon={DollarSign}
          chip="coral"
          value={formatCurrency(staff.monthlySales)}
          label="Monthly sales"
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

      <MyShiftCard staffId={staffId} />

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
            const next = findNextQueueTicket(queue, staffId, staff?.branchId);
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
