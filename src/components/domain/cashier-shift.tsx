"use client";

import { Coffee, LogOut, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/auth/session-provider";
import { useNow } from "@/hooks/use-now";
import { isRosteredOn, localIso } from "@/lib/roster";
import { useAppStore } from "@/lib/store/app-store";

function useClockIn(staffId: string) {
  const status = useAppStore((s) => s.staffStatuses[staffId] ?? "off-duty");
  const startShift = useAppStore((s) => s.startShift);
  const endShift = useAppStore((s) => s.endShift);
  const updateStaffStatus = useAppStore((s) => s.updateStaffStatus);
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);
  const now = useNow();

  function start() {
    if (!isRosteredOn(roster, leaves, staffId, localIso(now ?? new Date()))) {
      toast.warning("You're not rostered today", {
        description: "Your owner will see this as an unscheduled shift",
      });
    }
    const res = startShift(staffId);
    if (!res.ok) toast.error("Couldn't start your shift", { description: res.error });
    else toast.success("Shift started", { description: "You're on the floor" });
  }

  function end() {
    const res = endShift(staffId);
    if (!res.ok) toast.error("Can't end your shift yet", { description: res.error });
    else toast.success("Shift ended", { description: "See you next time" });
  }

  return {
    status,
    start,
    end,
    breakOn: () => updateStaffStatus(staffId, "break"),
    resume: () => updateStaffStatus(staffId, "available"),
  };
}

/** Clock in/out and breaks for a cashier. */
export function CashierShiftControls() {
  const staffId = useSession().staffId ?? "";
  const { status, start, end, breakOn, resume } = useClockIn(staffId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      {status === "off-duty" && (
        <Button size="lg" className="w-full" onClick={start}>
          <Play className="h-4 w-4" />
          Start Shift
        </Button>
      )}
      {status === "available" && (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={breakOn}>
            <Coffee className="h-4 w-4" />
            Break
          </Button>
          <Button variant="outline" onClick={end}>
            <LogOut className="h-4 w-4" />
            End Shift
          </Button>
        </div>
      )}
      {status === "break" && (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={resume}>
            <RotateCcw className="h-4 w-4" />
            Resume
          </Button>
          <Button variant="outline" onClick={end}>
            <LogOut className="h-4 w-4" />
            End Shift
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Non-blocking nudge across the cashier portal while not clocked in. */
export function CashierShiftBanner() {
  const session = useSession();
  const staffId = session.staffId ?? "";
  const { status, start } = useClockIn(staffId);
  if (session.role !== "cashier" || status !== "off-duty") return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-2 text-sm">
      <span className="text-[var(--warning)]">
        You&apos;re not clocked in — sales won&apos;t be tied to a shift.
      </span>
      <Button size="sm" onClick={start}>
        Start Shift
      </Button>
    </div>
  );
}
