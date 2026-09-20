"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { PosSubnav } from "@/components/domain/pos-subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/domain/stat-card";
import { useAppStore, drawerExpected } from "@/lib/store/app-store";
import { DRAWER_VARIANCE_TOLERANCE, NOTE_DENOMINATIONS, COINS_KEY } from "@/lib/drawer";
import type { DrawerSession } from "@/lib/types";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";

function sessionStats(s: DrawerSession) {
  const cashSales = s.movements
    .filter((m) => m.type === "sale")
    .reduce((sum, m) => sum + m.amount, 0);
  const refunds = s.movements
    .filter((m) => m.type === "refund")
    .reduce((sum, m) => sum + m.amount, 0);
  const payIn = s.movements
    .filter((m) => m.type === "pay-in")
    .reduce((sum, m) => sum + m.amount, 0);
  const payOut = s.movements
    .filter((m) => m.type === "pay-out")
    .reduce((sum, m) => sum + m.amount, 0);
  const expected = s.expectedAtClose ?? drawerExpected(s);
  const variance = s.variance ?? (s.countedAmount ?? expected) - expected;
  return { cashSales, refunds, payIn, payOut, expected, variance };
}

const MOVEMENT_LABEL = {
  sale: "Cash sale",
  refund: "Refund",
  "pay-in": "Cash in",
  "pay-out": "Cash out",
} as const;

function statusBadge(s: DrawerSession) {
  if (s.status === "needs-review") return <Badge variant="warning">Needs review</Badge>;
  if (s.status === "reviewed") return <Badge variant="success">Reviewed</Badge>;
  return <Badge variant="default">Closed</Badge>;
}

export default function OwnerCashDrawerPage() {
  const branchId = useAppStore((s) => s.branchId);
  const drawerSession = useAppStore((s) => s.drawerSession);
  const drawerHistory = useAppStore((s) => s.drawerHistory);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
  const reviewDrawer = useAppStore((s) => s.reviewDrawer);

  const [cashier, setCashier] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [ownerClose, setOwnerClose] = useState(false);
  const [ownerCount, setOwnerCount] = useState("");
  const [ownerReason, setOwnerReason] = useState("");

  const branchHistory = useMemo(
    () => drawerHistory.filter((d) => d.closedAt && d.branchId === branchId),
    [drawerHistory, branchId],
  );
  const cashiers = useMemo(
    () => [...new Set(branchHistory.map((d) => d.cashierName))],
    [branchHistory],
  );
  const closed = branchHistory.filter((d) => cashier === "all" || d.cashierName === cashier);

  const gross = closed.reduce(
    (acc, s) => {
      const v = sessionStats(s).variance;
      if (v < 0) acc.short += -v;
      else if (v > 0) acc.over += v;
      return acc;
    },
    { short: 0, over: 0 },
  );
  const pending = closed.filter((s) => s.status === "needs-review").length;
  const openHere = drawerSession && drawerSession.branchId === branchId ? drawerSession : null;

  function handleReview(id: string) {
    const res = reviewDrawer(id, reviewNote);
    if (!res.ok) {
      toast.error("Couldn't record the review", { description: res.error });
      return;
    }
    toast.success("Marked as reviewed");
    setReviewNote("");
  }

  function handleOwnerClose() {
    const c = Number(ownerCount);
    if (ownerCount === "" || Number.isNaN(c) || c < 0) {
      toast.error("Enter the counted cash");
      return;
    }
    const res = closeDrawer({ countedAmount: c, closingNote: ownerReason });
    if (res.result !== "closed") {
      toast.error("Couldn't close the drawer", { description: res.message });
      return;
    }
    toast.success("Drawer closed by owner");
    setOwnerClose(false);
    setOwnerCount("");
    setOwnerReason("");
  }

  return (
    <>
      <Topbar title="Point of Sale" />
      <PosSubnav base="/owner/pos" />
      <PageTransition>
        <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
          {pending > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--warning)]">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {pending} drawer close{pending > 1 ? "s are" : " is"} outside the
              RM{DRAWER_VARIANCE_TOLERANCE} tolerance and waiting for your review.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Shifts closed"
              value={String(closed.length)}
              change={openHere ? "1 open now" : "None open"}
              trend="neutral"
              icon={Wallet}
              delay={0}
            />
            <StatCard
              label="Needs review"
              value={String(pending)}
              change={pending > 0 ? "Open a row to review" : "All clear"}
              trend={pending > 0 ? "down" : "neutral"}
              icon={TriangleAlert}
              delay={0.05}
            />
            <StatCard
              label="Total short"
              value={formatCurrency(gross.short)}
              change="Across shifts shown"
              trend={gross.short > 0 ? "down" : "neutral"}
              icon={TriangleAlert}
              delay={0.1}
            />
            <StatCard
              label="Total over"
              value={formatCurrency(gross.over)}
              change="Across shifts shown"
              trend={gross.over > 0 ? "up" : "neutral"}
              icon={TriangleAlert}
              delay={0.15}
            />
          </div>

          {openHere && (
            <Card className="border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
              <CardHeader className="mb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" />
                  Open now — {openHere.cashierName}
                </CardTitle>
                <span className="text-xs text-[var(--text-faint)]">
                  since {formatTime(openHere.openedAt)}
                </span>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <Field label="Float" value={formatCurrency(openHere.openingFloat)} />
                <Field label="Cash sales" value={formatCurrency(sessionStats(openHere).cashSales)} />
                <Field
                  label="Cash in / out"
                  value={`${formatCurrency(sessionStats(openHere).payIn)} / ${formatCurrency(sessionStats(openHere).payOut)}`}
                />
                <Field label="Expected" value={formatCurrency(drawerExpected(openHere))} strong />
                <div className="flex items-end">
                  <Button variant="outline" size="sm" onClick={() => setOwnerClose(true)}>
                    <Lock className="h-4 w-4" />
                    Close as owner
                  </Button>
                </div>
              </div>
              {openHere.floatMismatch !== undefined && (
                <p className="mt-3 text-xs text-[var(--warning)]">
                  Opening float was {formatCurrency(Math.abs(openHere.floatMismatch))}{" "}
                  {openHere.floatMismatch > 0 ? "more" : "less"} than the last close
                  counted.
                </p>
              )}
            </Card>
          )}

          <Card className="p-0">
            <CardHeader className="p-4">
              <CardTitle>Shift history</CardTitle>
              {cashiers.length > 1 && (
                <Select
                  value={cashier}
                  onChange={(e) => setCashier(e.target.value)}
                  className="h-9 w-44 text-xs"
                  aria-label="Filter by cashier"
                >
                  <option value="all">All cashiers</option>
                  {cashiers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </CardHeader>
            {closed.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-[var(--text-muted)]">
                No shifts have been closed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-y border-[var(--border)] bg-[var(--bg-elevated)] text-xs uppercase tracking-wide text-[var(--text-faint)]">
                      <th className="w-8 px-2 py-2.5" />
                      <th className="px-2 py-2.5 text-left font-medium">Cashier</th>
                      <th className="px-3 py-2.5 text-left font-medium">Closed</th>
                      <th className="px-3 py-2.5 text-right font-medium">Float</th>
                      <th className="px-3 py-2.5 text-right font-medium">Cash sales</th>
                      <th className="px-3 py-2.5 text-right font-medium">Expected</th>
                      <th className="px-3 py-2.5 text-right font-medium">Counted</th>
                      <th className="px-3 py-2.5 text-right font-medium">Variance</th>
                      <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {closed.map((s) => {
                      const st = sessionStats(s);
                      const expanded = openId === s.id;
                      return (
                        <Fragment key={s.id}>
                          <tr
                            className="cursor-pointer hover:bg-[var(--bg-muted)]/40"
                            onClick={() => {
                              setOpenId(expanded ? null : s.id);
                              setReviewNote("");
                            }}
                          >
                            <td className="px-2 py-3 text-[var(--text-faint)]">
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </td>
                            <td className="px-2 py-3 font-medium">{s.cashierName}</td>
                            <td className="px-3 py-3 text-[var(--text-muted)]">
                              {formatDate(s.closedAt!)} {formatTime(s.closedAt!)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCurrency(s.openingFloat)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCurrency(st.cashSales)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCurrency(st.expected)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {formatCurrency(s.countedAmount ?? 0)}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-3 text-right font-medium tabular-nums",
                                st.variance < 0
                                  ? "text-[var(--danger)]"
                                  : st.variance > 0
                                    ? "text-[var(--info)]"
                                    : "text-[var(--success)]",
                              )}
                            >
                              {st.variance > 0 && "+"}
                              {formatCurrency(st.variance)}
                            </td>
                            <td className="px-3 py-3">{statusBadge(s)}</td>
                          </tr>
                          {expanded && (
                            <tr className="bg-[var(--bg-muted)]/30">
                              <td colSpan={9} className="space-y-4 px-6 py-4 text-sm">
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                                      Movements
                                    </p>
                                    <div className="space-y-1">
                                      <Line label="Opening float" value={formatCurrency(s.openingFloat)} />
                                      {s.movements.map((m) => (
                                        <Line
                                          key={m.id}
                                          label={`${MOVEMENT_LABEL[m.type]} · ${m.note}${m.by ? ` (${m.by})` : ""}`}
                                          value={`${m.amount > 0 ? "+" : ""}${formatCurrency(m.amount)}`}
                                        />
                                      ))}
                                      <Line label="Expected" value={formatCurrency(st.expected)} strong />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-faint)]">
                                      The count
                                    </p>
                                    <div className="space-y-1">
                                      {(s.counts ?? []).map((c, i) => (
                                        <Line
                                          key={i}
                                          label={`Attempt ${i + 1} · ${formatTime(c.at)}`}
                                          value={formatCurrency(c.amount)}
                                        />
                                      ))}
                                      {s.denominations &&
                                        NOTE_DENOMINATIONS.filter((n) => s.denominations![n.key]).map(
                                          (n) => (
                                            <Line
                                              key={n.key}
                                              label={`${n.label} × ${s.denominations![n.key]}`}
                                              value={formatCurrency(s.denominations![n.key] * n.value)}
                                            />
                                          ),
                                        )}
                                      {s.denominations?.[COINS_KEY] ? (
                                        <Line label="Coins" value={formatCurrency(s.denominations[COINS_KEY])} />
                                      ) : null}
                                      {s.closedByOwner && (
                                        <p className="text-xs text-[var(--text-faint)]">
                                          Closed by the owner.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {s.floatMismatch !== undefined && (
                                  <p className="text-xs text-[var(--warning)]">
                                    Opened with a float {formatCurrency(Math.abs(s.floatMismatch))}{" "}
                                    {s.floatMismatch > 0 ? "above" : "below"} the previous close.
                                  </p>
                                )}
                                {s.varianceReason && (
                                  <p className="rounded-lg bg-[var(--bg-elevated)] px-3 py-2">
                                    <span className="font-medium">{s.closedBy ?? s.cashierName}:</span>{" "}
                                    {s.varianceReason}
                                  </p>
                                )}
                                {s.closingNote && !s.varianceReason && (
                                  <p className="text-[var(--text-muted)]">Note: {s.closingNote}</p>
                                )}

                                {s.status === "needs-review" && (
                                  <div className="flex flex-wrap items-end gap-3">
                                    <div className="min-w-[220px] flex-1">
                                      <Label htmlFor={`rv-${s.id}`}>Review note (optional)</Label>
                                      <Input
                                        id={`rv-${s.id}`}
                                        value={reviewNote}
                                        onChange={(e) => setReviewNote(e.target.value)}
                                        placeholder="What you checked or decided"
                                      />
                                    </div>
                                    <Button onClick={() => handleReview(s.id)}>Mark as reviewed</Button>
                                  </div>
                                )}
                                {s.status === "reviewed" && (
                                  <p className="text-xs text-[var(--text-faint)]">
                                    Reviewed by {s.reviewedBy}
                                    {s.reviewedAt && ` · ${formatDate(s.reviewedAt)} ${formatTime(s.reviewedAt)}`}
                                    {s.reviewNote && ` — ${s.reviewNote}`}
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </PageTransition>

      <Modal
        open={ownerClose}
        onOpenChange={setOwnerClose}
        title="Close drawer as owner"
        description="You can see the expected figure. The close is recorded as done by you."
      >
        {openHere && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-muted)] px-4 py-3 text-sm">
              <span className="text-[var(--text-muted)]">Expected</span>
              <span className="font-medium">{formatCurrency(drawerExpected(openHere))}</span>
            </div>
            <div>
              <Label htmlFor="oc-count">Counted cash (RM)</Label>
              <Input
                id="oc-count"
                type="number"
                min={0}
                value={ownerCount}
                onChange={(e) => setOwnerCount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="oc-reason">Reason (optional)</Label>
              <Input
                id="oc-reason"
                value={ownerReason}
                onChange={(e) => setOwnerReason(e.target.value)}
                placeholder="e.g. cashier left without closing"
              />
            </div>
            <Button className="w-full" onClick={handleOwnerClose}>
              Close drawer
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-faint)]">{label}</p>
      <p className={strong ? "font-display text-lg font-semibold text-[var(--gold-soft)]" : "font-medium"}>
        {value}
      </p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-[var(--border)] pt-1 font-medium")}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
