"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, LogOut, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/session-provider";
import { useNow } from "@/hooks/use-now";
import { isRosteredOn, leaveOn, localIso } from "@/lib/roster";
import { useAppStore } from "@/lib/store/app-store";

function useClockIn(staffId: string) {
  const status = useAppStore((s) => s.staffStatuses[staffId] ?? "off-duty");
  const queueHydrated = useAppStore((s) => s.queueHydrated);
  const startShift = useAppStore((s) => s.startShift);
  const endShift = useAppStore((s) => s.endShift);
  const updateStaffStatus = useAppStore((s) => s.updateStaffStatus);
  const roster = useAppStore((s) => s.roster);
  const leaves = useAppStore((s) => s.leaves);
  const now = useNow();

  function start(branchId?: string) {
    const today = localIso(now ?? new Date());
    if (!isRosteredOn(roster, leaves, staffId, today)) {
      const onLeave = leaveOn(leaves, staffId, today);
      toast.warning(onLeave ? "You're on leave today" : "You're not rostered today", {
        description: "Your owner will see this as an unscheduled shift",
      });
    }
    const res = startShift(staffId, branchId ? { branchId } : undefined);
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
    queueHydrated,
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
  const staff = useAppStore((s) => s.staff.find((m) => m.id === staffId));
  const branches = useAppStore((s) => s.branches);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("");

  function handleStart() {
    if (branches.length > 1) {
      setSelectedBranchId(staff?.homeBranchId ?? staff?.branchId ?? "");
      setBranchModalOpen(true);
      return;
    }
    start();
  }

  function confirmStart() {
    start(selectedBranchId);
    setBranchModalOpen(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shift</CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      {status === "off-duty" && (
        <Button size="lg" className="w-full" onClick={handleStart}>
          <Play className="h-4 w-4" />
          Start Shift
        </Button>
      )}
      <Modal
        open={branchModalOpen}
        onOpenChange={setBranchModalOpen}
        title="Working at"
        description="Pick which branch you're covering today"
      >
        <Label>Branch</Label>
        <Select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.id === (staff?.homeBranchId ?? staff?.branchId) ? " (home)" : ""}
            </option>
          ))}
        </Select>
        <Button className="mt-5 w-full" size="lg" onClick={confirmStart}>
          Start Shift
        </Button>
      </Modal>
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
  const router = useRouter();
  const { status, queueHydrated, start } = useClockIn(staffId);
  const branches = useAppStore((s) => s.branches);
  // Nothing has been heard from the database yet, so "off-duty" here is a
  // placeholder, not a confirmed status — showing the warning on it would be
  // a false alarm for someone who is actually clocked in.
  if (session.role !== "cashier" || !queueHydrated || status !== "off-duty") {
    return null;
  }

  // More than one branch means they might be covering elsewhere today —
  // send them to the full shift card so they can pick, rather than
  // one-tapping them straight into their home branch here.
  function handleStart() {
    if (branches.length > 1) {
      router.push("/cashier/dashboard");
      return;
    }
    start();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-2 text-sm">
      <span className="text-[var(--warning)]">
        You&apos;re not clocked in — sales won&apos;t be tied to a shift.
      </span>
      <Button size="sm" onClick={handleStart}>
        Start Shift
      </Button>
    </div>
  );
}
