"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { PosSubnav } from "@/components/domain/pos-subnav";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/session-provider";
import { useAppStore } from "@/lib/store/app-store";
import {
  CASHIER_PAYOUT_LIMIT,
  COINS_KEY,
  MIN_VARIANCE_REASON,
  NOTE_DENOMINATIONS,
  PAYIN_CATEGORIES,
  PAYOUT_CATEGORIES,
  denominationTotal,
} from "@/lib/drawer";
import type { CashMovement } from "@/lib/types";
import { formatCurrency, formatTime } from "@/lib/utils";

const MOVEMENT_LABEL: Record<CashMovement["type"], string> = {
  sale: "Cash sale",
  refund: "Refund",
  "pay-in": "Cash in",
  "pay-out": "Cash out",
};

export default function CashierDrawerPage() {
  const session = useSession();
  const myStaffId = session.staffId ?? "";
  const status = useAppStore((s) => s.staffStatuses[myStaffId] ?? "off-duty");
  const drawerSession = useAppStore((s) => s.drawerSession);
  const drawerHistory = useAppStore((s) => s.drawerHistory);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const addCashMovement = useAppStore((s) => s.addCashMovement);
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  const [float, setFloat] = useState("");
  const [moveType, setMoveType] = useState<"pay-in" | "pay-out" | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [moveCategory, setMoveCategory] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [closeNote, setCloseNote] = useState("");
  const [needReason, setNeedReason] = useState(false);
  const [recounted, setRecounted] = useState(false);

  const lastClosed = drawerHistory.find((d) => d.closedAt);
  const offDuty = status === "off-duty";

  const countRecord: Record<string, number> = Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, Number(v) || 0]),
  );
  const countedTotal = denominationTotal(countRecord);

  function handleOpen() {
    const f = Number(float);
    if (float === "" || Number.isNaN(f) || f < 0) {
      toast.error("Count your opening float first");
      return;
    }
    const res = openDrawer({
      cashierId: myStaffId || session.authUserId,
      cashierName: session.name,
      openingFloat: f,
    });
    if (!res.ok) {
      toast.error("Couldn't open the drawer", { description: res.error });
      return;
    }
    toast.success("Drawer open", {
      description: `Opening float ${formatCurrency(f)}`,
    });
    setFloat("");
  }

  function resetMove() {
    setMoveType(null);
    setMoveAmount("");
    setMoveNote("");
    setMoveCategory("");
  }

  function handleAddMovement() {
    const amt = Number(moveAmount) || 0;
    if (amt <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (!moveCategory) {
      toast.error("Pick a reason");
      return;
    }
    if (moveCategory === "Other" && !moveNote.trim()) {
      toast.error("Add a note for \"Other\"");
      return;
    }
    const note = moveNote.trim() ? `${moveCategory} · ${moveNote.trim()}` : moveCategory;
    const res = addCashMovement({
      type: moveType!,
      amount: amt,
      note,
      category: moveCategory,
    });
    if (!res.ok) {
      toast.error("Not recorded", { description: res.error });
      return;
    }
    toast.success(MOVEMENT_LABEL[moveType!], {
      description: `${formatCurrency(amt)} · ${note}`,
    });
    resetMove();
  }

  function resetClose() {
    setCounts({});
    setCloseNote("");
    setNeedReason(false);
    setRecounted(false);
  }

  function handleClose() {
    if (countedTotal <= 0) {
      toast.error("Count the cash in the drawer first");
      return;
    }
    if (needReason && closeNote.trim().length < MIN_VARIANCE_REASON) {
      toast.error("Explain what happened", {
        description: `At least ${MIN_VARIANCE_REASON} characters`,
      });
      return;
    }
    const res = closeDrawer({
      countedAmount: countedTotal,
      denominations: countRecord,
      closingNote: closeNote,
    });
    switch (res.result) {
      case "closed":
        toast.success("Drawer closed", {
          description: "The next cashier opens with their own count",
        });
        setCloseOpen(false);
        resetClose();
        break;
      case "needs-review":
        toast.success("Drawer closed", {
          description: "Sent to the owner for review",
        });
        setCloseOpen(false);
        resetClose();
        break;
      case "recount":
        toast.warning("That count doesn't match", {
          description: "Please recount carefully — you get one more try",
        });
        setCounts({});
        setRecounted(true);
        break;
      case "reason-required":
        toast.warning("Still doesn't match", {
          description: "Add a note explaining what happened, then submit again",
        });
        setNeedReason(true);
        break;
      default:
        toast.error("Can't close the drawer", { description: res.message });
    }
  }

  // ---- No open drawer ----
  if (!drawerSession) {
    return (
      <>
        <Topbar title="Point of Sale" />
        <PosSubnav base="/cashier/pos" />
        <PageTransition>
          <div className="mx-auto max-w-md space-y-5 p-4 md:p-6">
            <Card className="p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gold)]/12">
                <Wallet className="h-7 w-7 text-[var(--gold-soft)]" />
              </div>
              <h1 className="mt-3 font-display text-lg font-bold">
                Drawer is closed
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Count the cash in the drawer yourself and enter it as the
                opening float.
              </p>
              {offDuty && (
                <p className="mt-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
                  You&apos;re not clocked in.{" "}
                  <Link href="/cashier/dashboard" className="underline">
                    Start your shift
                  </Link>{" "}
                  first.
                </p>
              )}
              <div className="mt-5 text-left">
                <Label htmlFor="float">Opening float (RM)</Label>
                <Input
                  id="float"
                  type="number"
                  min={0}
                  step={10}
                  value={float}
                  onChange={(e) => setFloat(e.target.value)}
                  placeholder="What you counted"
                />
              </div>
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={handleOpen}
                disabled={offDuty}
              >
                Open drawer
              </Button>
            </Card>

            {lastClosed && (
              <p className="text-center text-xs text-[var(--text-faint)]">
                Last closed by {lastClosed.closedBy ?? lastClosed.cashierName} at{" "}
                {formatTime(lastClosed.closedAt!)}
              </p>
            )}
          </div>
        </PageTransition>
      </>
    );
  }

  // ---- Open drawer ----
  const cashSaleCount = drawerSession.movements.filter((m) => m.type === "sale").length;
  const mine = !myStaffId || drawerSession.cashierId === myStaffId;
  const categories = moveType === "pay-in" ? PAYIN_CATEGORIES : PAYOUT_CATEGORIES;

  return (
    <>
      <Topbar
        title="Point of Sale"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
            Open since {formatTime(drawerSession.openedAt)}
          </span>
        }
      />
      <PosSubnav base="/cashier/pos" />
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--success)]/12">
                <ShieldCheck className="h-5 w-5 text-[var(--success)]" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">Drawer open</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {drawerSession.cashierName} · since {formatTime(drawerSession.openedAt)}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Opening float</p>
                <p className="font-medium">
                  {formatCurrency(drawerSession.openingFloat)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Cash sales today</p>
                <p className="font-medium">{cashSaleCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              The drawer total isn&apos;t shown — you count the cash when you close, and
              the system checks it.
            </p>
          </Card>

          {!mine && (
            <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--warning)]">
              This drawer belongs to {drawerSession.cashierName}. Only they can add cash
              or close it.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={!mine} onClick={() => setMoveType("pay-in")}>
              <ArrowDownToLine className="h-4 w-4" />
              Cash in
            </Button>
            <Button variant="secondary" disabled={!mine} onClick={() => setMoveType("pay-out")}>
              <ArrowUpFromLine className="h-4 w-4" />
              Cash out
            </Button>
          </div>

          {moveType && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium">
                {moveType === "pay-in" ? "Add cash to the drawer" : "Take cash out"}
              </p>
              {moveType === "pay-out" && (
                <p className="text-xs text-[var(--text-faint)]">
                  You can take out up to {formatCurrency(CASHIER_PAYOUT_LIMIT)} at a time.
                  Anything larger goes through the owner.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="mv-cat">Reason</Label>
                  <Select
                    id="mv-cat"
                    value={moveCategory}
                    onChange={(e) => setMoveCategory(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="mv-amt">Amount (RM)</Label>
                  <Input
                    id="mv-amt"
                    type="number"
                    min={0}
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="mv-note">
                  Note {moveCategory === "Other" ? "(required)" : "(optional)"}
                </Label>
                <Input
                  id="mv-note"
                  value={moveNote}
                  onChange={(e) => setMoveNote(e.target.value)}
                  placeholder="Any detail the owner should know"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={resetMove}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAddMovement}>
                  Record
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <CardHeader className="mb-2">
              <CardTitle className="text-sm">
                Activity ({drawerSession.movements.length})
              </CardTitle>
            </CardHeader>
            {drawerSession.movements.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                Nothing yet this shift.
              </p>
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {[...drawerSession.movements].reverse().map((m) => {
                  const manual = m.type === "pay-in" || m.type === "pay-out";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{MOVEMENT_LABEL[m.type]}</p>
                        <p className="truncate text-xs text-[var(--text-faint)]">
                          {formatTime(m.at)} · {m.note}
                        </p>
                      </div>
                      {manual && (
                        <span
                          className={
                            m.amount < 0
                              ? "shrink-0 text-[var(--danger)]"
                              : "shrink-0 text-[var(--success)]"
                          }
                        >
                          {m.amount < 0 ? "" : "+"}
                          {formatCurrency(m.amount)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Button
            className="w-full"
            size="lg"
            disabled={!mine}
            onClick={() => {
              resetClose();
              setCloseOpen(true);
            }}
          >
            <Lock className="h-4 w-4" />
            Close drawer
          </Button>
        </div>
      </PageTransition>

      <Modal
        open={closeOpen}
        onOpenChange={(o) => {
          setCloseOpen(o);
          if (!o) resetClose();
        }}
        title="Close drawer"
        description="Count every note and coin in the drawer. The next cashier will count their own float."
      >
        <div className="space-y-4">
          {recounted && (
            <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
              Recount from scratch. This is your last try before the owner is asked
              to review.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {NOTE_DENOMINATIONS.map((n) => (
              <div key={n.key}>
                <Label htmlFor={`dn-${n.key}`}>
                  {n.label} notes
                  <span className="ml-1 text-[var(--text-faint)]">
                    {(Number(counts[n.key]) || 0) > 0
                      ? `= ${formatCurrency((Number(counts[n.key]) || 0) * n.value)}`
                      : ""}
                  </span>
                </Label>
                <Input
                  id={`dn-${n.key}`}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={counts[n.key] ?? ""}
                  onChange={(e) =>
                    setCounts((c) => ({ ...c, [n.key]: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            ))}
            <div className="col-span-2">
              <Label htmlFor="dn-coins">Coins, total value (RM)</Label>
              <Input
                id="dn-coins"
                type="number"
                min={0}
                step={0.1}
                value={counts[COINS_KEY] ?? ""}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [COINS_KEY]: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-muted)] px-4 py-3">
            <span className="text-sm text-[var(--text-muted)]">You counted</span>
            <span className="font-display text-xl font-semibold text-[var(--gold-soft)]">
              {formatCurrency(countedTotal)}
            </span>
          </div>

          <div>
            <Label htmlFor="close-note">
              {needReason
                ? `What happened? (required, ${MIN_VARIANCE_REASON}+ characters)`
                : "Note (optional)"}
            </Label>
            <Input
              id="close-note"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder={
                needReason
                  ? "Explain the difference as best you can"
                  : "Anything the owner should know"
              }
            />
          </div>
          <Button className="w-full" size="lg" onClick={handleClose}>
            Submit count
          </Button>
        </div>
      </Modal>
    </>
  );
}
