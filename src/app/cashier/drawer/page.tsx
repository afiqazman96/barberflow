"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/session-provider";
import { useAppStore, drawerExpected } from "@/lib/store/app-store";
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
  const drawerSession = useAppStore((s) => s.drawerSession);
  const drawerHistory = useAppStore((s) => s.drawerHistory);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const addCashMovement = useAppStore((s) => s.addCashMovement);
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  const [float, setFloat] = useState("200");
  const [moveType, setMoveType] = useState<"pay-in" | "pay-out" | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveNote, setMoveNote] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [changeShift, setChangeShift] = useState(false);

  const lastClosed = drawerHistory[0];
  const expected = drawerSession ? drawerExpected(drawerSession) : 0;

  function handleOpen() {
    const f = Number(float) || 0;
    openDrawer({
      cashierId: session.staffId ?? session.authUserId,
      cashierName: session.name,
      openingFloat: f,
    });
    toast.success("Drawer open", {
      description: `Opening float ${formatCurrency(f)}`,
    });
  }

  function handleAddMovement() {
    const amt = Number(moveAmount) || 0;
    if (amt <= 0) {
      toast.error("Enter an amount");
      return;
    }
    if (!moveNote.trim()) {
      toast.error("Add a note so the drawer log makes sense");
      return;
    }
    addCashMovement({ type: moveType!, amount: amt, note: moveNote.trim() });
    toast.success(MOVEMENT_LABEL[moveType!], {
      description: `${formatCurrency(amt)} · ${moveNote.trim()}`,
    });
    setMoveType(null);
    setMoveAmount("");
    setMoveNote("");
  }

  function handleClose() {
    const c = Number(counted) || 0;
    closeDrawer({ countedAmount: c, closingNote: closeNote });
    setCloseOpen(false);
    const diff = c - expected;
    toast.success("Drawer closed", {
      description:
        diff === 0
          ? "Counted matches expected"
          : diff > 0
            ? `Over by ${formatCurrency(diff)}`
            : `Short by ${formatCurrency(-diff)}`,
    });
    if (changeShift) {
      setChangeShift(false);
      // Straight into the next shift with the counted cash as the new float.
      openDrawer({
        cashierId: session.staffId ?? session.authUserId,
        cashierName: session.name,
        openingFloat: c,
      });
      toast.message("Next shift open", {
        description: `Float carried over: ${formatCurrency(c)}`,
      });
    }
    setCounted("");
    setCloseNote("");
  }

  // ---- No open drawer ----
  if (!drawerSession) {
    return (
      <>
        <Topbar title="Cash Drawer" />
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
                Count your opening float and open the till to start taking cash.
              </p>
              <div className="mt-5 text-left">
                <Label>Opening float (RM)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={float}
                  onChange={(e) => setFloat(e.target.value)}
                />
              </div>
              <Button className="mt-4 w-full" size="lg" onClick={handleOpen}>
                Open drawer
              </Button>
            </Card>

            {lastClosed && (
              <Card className="p-4 text-sm">
                <CardHeader className="mb-2">
                  <CardTitle className="text-sm">Last shift</CardTitle>
                </CardHeader>
                <div className="space-y-1 text-[var(--text-muted)]">
                  <Row
                    label={`${lastClosed.cashierName} · closed ${formatTime(lastClosed.closedAt ?? lastClosed.openedAt)}`}
                  />
                  <Row
                    label="Expected"
                    value={formatCurrency(drawerExpected(lastClosed))}
                  />
                  <Row
                    label="Counted"
                    value={formatCurrency(lastClosed.countedAmount ?? 0)}
                  />
                  <Variance
                    diff={
                      (lastClosed.countedAmount ?? 0) -
                      drawerExpected(lastClosed)
                    }
                  />
                </div>
              </Card>
            )}
          </div>
        </PageTransition>
      </>
    );
  }

  // ---- Open drawer ----
  const sums = drawerSession.movements.reduce(
    (acc, m) => {
      if (m.type === "sale") acc.sales += m.amount;
      else if (m.type === "refund") acc.refunds += m.amount;
      else if (m.type === "pay-in") acc.payIn += m.amount;
      else acc.payOut += m.amount;
      return acc;
    },
    { sales: 0, refunds: 0, payIn: 0, payOut: 0 },
  );

  return (
    <>
      <Topbar
        title="Cash Drawer"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
            Open since {formatTime(drawerSession.openedAt)}
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
          <Card className="p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-[var(--text-faint)]">
              Expected in drawer
            </p>
            <p className="mt-1 font-display text-4xl font-bold text-[var(--gold-soft)]">
              {formatCurrency(expected)}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {drawerSession.cashierName}
            </p>
          </Card>

          <Card className="p-4 text-sm">
            <CardHeader className="mb-2">
              <CardTitle className="text-sm">Breakdown</CardTitle>
            </CardHeader>
            <div className="space-y-1">
              <Row
                label="Opening float"
                value={formatCurrency(drawerSession.openingFloat)}
              />
              <Row label="Cash sales" value={`+${formatCurrency(sums.sales)}`} />
              {sums.refunds < 0 && (
                <Row
                  label="Refunds"
                  value={formatCurrency(sums.refunds)}
                  tone="danger"
                />
              )}
              {sums.payIn > 0 && (
                <Row label="Cash in" value={`+${formatCurrency(sums.payIn)}`} />
              )}
              {sums.payOut < 0 && (
                <Row
                  label="Cash out"
                  value={formatCurrency(sums.payOut)}
                  tone="danger"
                />
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setMoveType("pay-in")}>
              <ArrowDownToLine className="h-4 w-4" />
              Cash in
            </Button>
            <Button variant="secondary" onClick={() => setMoveType("pay-out")}>
              <ArrowUpFromLine className="h-4 w-4" />
              Cash out
            </Button>
          </div>

          {moveType && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-medium">
                {moveType === "pay-in" ? "Add cash to drawer" : "Remove cash"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Amount (RM)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input
                    value={moveNote}
                    onChange={(e) => setMoveNote(e.target.value)}
                    placeholder={
                      moveType === "pay-in" ? "e.g. change top-up" : "e.g. bank drop"
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setMoveType(null)}
                >
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
                Movements ({drawerSession.movements.length})
              </CardTitle>
            </CardHeader>
            {drawerSession.movements.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">
                Nothing yet this shift.
              </p>
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
                {[...drawerSession.movements].reverse().map((m) => (
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
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setChangeShift(true);
                setCloseOpen(true);
              }}
            >
              <Repeat className="h-4 w-4" />
              Change shift
            </Button>
            <Button
              onClick={() => {
                setChangeShift(false);
                setCloseOpen(true);
              }}
            >
              <Lock className="h-4 w-4" />
              Close drawer
            </Button>
          </div>
        </div>
      </PageTransition>

      <Modal
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={changeShift ? "Change shift" : "Close drawer"}
        description={
          changeShift
            ? "Count the drawer, then the next cashier carries it as their float."
            : "Count the cash in the drawer and enter the total."
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-sm">
            <Row label="Expected" value={formatCurrency(expected)} />
          </div>
          <div>
            <Label>Counted cash (RM)</Label>
            <Input
              type="number"
              min={0}
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              autoFocus
            />
          </div>
          {counted !== "" && (
            <Variance diff={(Number(counted) || 0) - expected} big />
          )}
          <div>
            <Label>Note (optional)</Label>
            <Input
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="e.g. RM5 short — miscount on sale FH-KL-1203"
            />
          </div>
          <Button className="w-full" size="lg" onClick={handleClose}>
            {changeShift ? "Close & start next shift" : "Close drawer"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value?: string;
  tone?: "danger";
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--text-muted)]">{label}</span>
      {value && (
        <span
          className={
            tone === "danger" ? "text-[var(--danger)]" : "text-[var(--text)]"
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}

function Variance({ diff, big }: { diff: number; big?: boolean }) {
  const label =
    diff === 0
      ? "Balanced"
      : diff > 0
        ? `Over by ${formatCurrency(diff)}`
        : `Short by ${formatCurrency(-diff)}`;
  const color =
    diff === 0
      ? "text-[var(--success)]"
      : diff > 0
        ? "text-[var(--info)]"
        : "text-[var(--danger)]";
  return big ? (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-display text-lg font-semibold ${color} ${
        diff === 0
          ? "border-[var(--success)]/30 bg-[var(--success)]/8"
          : diff > 0
            ? "border-[var(--info)]/30 bg-[var(--info)]/8"
            : "border-[var(--danger)]/30 bg-[var(--danger)]/8"
      }`}
    >
      {diff === 0 && <CheckCircle2 className="h-5 w-5" />}
      {label}
    </motion.div>
  ) : (
    <div className={`flex justify-between gap-4 font-medium ${color}`}>
      <span>Variance</span>
      <span>{label}</span>
    </div>
  );
}
