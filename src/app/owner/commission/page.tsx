"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Info,
  Trophy,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Percent,
  DollarSign,
  Sparkles,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatTile } from "@/components/domain/stat-tile";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { recordCommissionPayout } from "@/lib/shop/actions";
import { useAppStore } from "@/lib/store/app-store";
import type { CommissionRule, CommissionType, Product, Service } from "@/lib/types";
import { formatCurrency, initials } from "@/lib/utils";

type LedgerEntry = { earned: number; paid: number; owed: number };

function ruleDescription(
  rule: CommissionRule,
  services: Service[],
  products: Product[],
): string {
  const applies =
    rule.appliesTo === "all"
      ? "all sales"
      : `${rule.appliesTo} items only`;
  switch (rule.type) {
    case "percentage":
      return `${rule.value}% of ${applies}${rule.staffId ? " (staff override)" : ""}`;
    case "fixed":
      return `Fixed ${formatCurrency(rule.value)} bonus per eligible ${rule.appliesTo}`;
    case "service-based":
      return `Extra ${rule.value}% on specific service${rule.serviceId ? `: ${services.find((s) => s.id === rule.serviceId)?.name}` : ""}`;
    case "product-based":
      return `Extra ${rule.value}% on specific product${rule.productId ? `: ${products.find((p) => p.id === rule.productId)?.name}` : ""}`;
    default:
      return rule.name;
  }
}

function ruleTypeIcon(type: CommissionRule["type"]) {
  switch (type) {
    case "fixed":
      return DollarSign;
    case "percentage":
      return Percent;
    default:
      return Sparkles;
  }
}

type RuleForm = {
  name: string;
  type: CommissionType;
  value: string;
  appliesTo: CommissionRule["appliesTo"];
  serviceId: string;
  productId: string;
  staffId: string;
  active: boolean;
};

const emptyRuleForm = (): RuleForm => ({
  name: "",
  type: "percentage",
  value: "30",
  appliesTo: "service",
  serviceId: "",
  productId: "",
  staffId: "",
  active: true,
});

function ruleToForm(rule: CommissionRule): RuleForm {
  return {
    name: rule.name,
    type: rule.type,
    value: String(rule.value),
    appliesTo: rule.appliesTo,
    serviceId: rule.serviceId ?? "",
    productId: rule.productId ?? "",
    staffId: rule.staffId ?? "",
    active: rule.active,
  };
}

export default function OwnerCommissionPage() {
  const commissionRules = useAppStore((s) => s.commissionRules);
  const updateCommissionRule = useAppStore((s) => s.updateCommissionRule);
  const addCommissionRule = useAppStore((s) => s.addCommissionRule);
  const allSales = useAppStore((s) => s.sales);
  const activeBranchId = useAppStore((s) => s.branchId);
  // Voided sales earned nothing, and other branches aren't this leaderboard.
  const sales = useMemo(
    () => allSales.filter((s) => !s.voided && s.branchId === activeBranchId),
    [allSales, activeBranchId],
  );
  const staff = useAppStore((s) => s.staff);
  const services = useAppStore((s) => s.services);
  const products = useAppStore((s) => s.products);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyRuleForm);
  const [ledger, setLedger] = useState<Record<string, LedgerEntry>>({});
  const [payoutFor, setPayoutFor] = useState<{ id: string; name: string; owed: number } | null>(
    null,
  );
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payingOut, setPayingOut] = useState(false);

  async function loadLedger() {
    try {
      const res = await fetch("/api/commission/ledger", { cache: "no-store" });
      if (res.ok) setLedger(await res.json());
    } catch {
      // The payout card just shows zeros until the next successful load.
    }
  }
  useEffect(() => {
    void loadLedger();
  }, []);

  function openPayout(staffId: string, name: string) {
    const owed = ledger[staffId]?.owed ?? 0;
    setPayoutFor({ id: staffId, name, owed });
    setPayoutAmount(owed > 0 ? owed.toFixed(2) : "");
    setPayoutNote("");
  }

  async function confirmPayout() {
    if (!payoutFor) return;
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Check the amount");
      return;
    }
    setPayingOut(true);
    const result = await recordCommissionPayout({
      staffId: payoutFor.id,
      amount,
      note: payoutNote.trim() || undefined,
    });
    setPayingOut(false);
    if (!result.ok) {
      toast.error("Couldn't record the payout", { description: result.error });
      return;
    }
    toast.success("Commission paid", {
      description: `${payoutFor.name} · ${formatCurrency(amount)}`,
    });
    setPayoutFor(null);
    void loadLedger();
  }

  const barbers = useMemo(
    () => staff.filter((s) => s.role === "barber" && s.branchId === activeBranchId),
    [staff, activeBranchId],
  );

  const leaderboard = useMemo(() => {
    const map = new Map<string, { sales: number; commission: number; count: number }>();
    sales.forEach((sale) => {
      const cur = map.get(sale.staffId) ?? { sales: 0, commission: 0, count: 0 };
      map.set(sale.staffId, {
        sales: cur.sales + sale.total,
        commission: cur.commission + sale.commission,
        count: cur.count + 1,
      });
    });
    return barbers
      .map((s) => ({
        staff: s,
        ...(map.get(s.id) ?? { sales: 0, commission: 0, count: 0 }),
      }))
      .sort((a, b) => b.commission - a.commission);
  }, [sales, barbers]);

  const totalCommission = sales.reduce((sum, s) => sum + s.commission, 0);
  const activeRules = commissionRules.filter((r) => r.active).length;

  function toggleRule(id: string) {
    const rule = commissionRules.find((r) => r.id === id);
    if (!rule) return;
    const nextActive = !rule.active;
    updateCommissionRule(id, { active: nextActive });
    toast.success(nextActive ? "Rule enabled" : "Rule disabled", {
      description: rule.name,
    });
  }

  function openAddRule() {
    setEditingRuleId(null);
    setForm(emptyRuleForm());
    setRuleModalOpen(true);
  }

  function openEditRule(rule: CommissionRule) {
    setEditingRuleId(rule.id);
    setForm(ruleToForm(rule));
    setRuleModalOpen(true);
  }

  function handleSubmitRule(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    const rawValue = Number(form.value) || 0;
    // Percentage-flavoured rules pay out as a share of the sale, so a value
    // over 100% would hand the barber more than the sale is worth. A flat
    // Fixed bonus has no such ceiling.
    const value =
      form.type === "fixed"
        ? Math.max(0, rawValue)
        : Math.min(100, Math.max(0, rawValue));

    const data = {
      name: form.name.trim(),
      type: form.type,
      value,
      appliesTo: form.appliesTo,
      serviceId: form.serviceId || undefined,
      productId: form.productId || undefined,
      staffId: form.staffId || undefined,
      active: form.active,
    };

    if (editingRuleId) {
      updateCommissionRule(editingRuleId, data);
      toast.success("Rule saved", { description: data.name });
    } else {
      const rule = addCommissionRule(data);
      toast.success("Rule added", { description: rule.name });
    }
    setRuleModalOpen(false);
    setEditingRuleId(null);
    setForm(emptyRuleForm());
  }

  const showServicePicker =
    form.type === "service-based" || form.appliesTo === "service";
  const showProductPicker =
    form.type === "product-based" || form.appliesTo === "product";

  return (
    <>
      <Topbar
        title="Commission Engine"
        actions={
          <Button size="sm" onClick={openAddRule}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              icon={DollarSign}
              chip="mint"
              value={formatCurrency(totalCommission)}
              label={`Total commission · ${sales.length} txn${sales.length === 1 ? "" : "s"}`}
              delay={0}
            />
            <StatTile
              icon={Percent}
              chip="sky"
              value={String(activeRules)}
              label={`Active rules · ${commissionRules.length} configured`}
              delay={0.05}
            />
            <StatTile
              icon={Trophy}
              chip="amber"
              value={leaderboard[0]?.staff.name.split(" ")[0] ?? "—"}
              label={`Top earner · ${formatCurrency(leaderboard[0]?.commission ?? 0)}`}
              delay={0.1}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-[var(--gold)]" />
                  Commission Rules
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {commissionRules.map((rule, i) => {
                  const Icon = ruleTypeIcon(rule.type);
                  return (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`card-surface border-l-4 p-4 transition ${
                        rule.active
                          ? "border-l-[var(--gold)] bg-[var(--gold)]/5"
                          : "border-l-[var(--border)] bg-[var(--bg-muted)]/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)]">
                            <Icon className="h-4 w-4 text-[var(--gold)]" />
                          </div>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                              {ruleDescription(rule, services, products)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge variant="default" className="capitalize">
                                {rule.type.replace("-", " ")}
                              </Badge>
                              <Badge variant="gold">
                                {rule.type === "percentage" || rule.type.includes("based")
                                  ? `${rule.value}%`
                                  : formatCurrency(rule.value)}
                              </Badge>
                              <Badge variant="default">{rule.appliesTo}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openEditRule(rule)}
                            className="p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                            aria-label={`Edit ${rule.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleRule(rule.id)}
                            className="text-[var(--gold)]"
                            aria-label={rule.active ? "Disable rule" : "Enable rule"}
                          >
                            {rule.active ? (
                              <ToggleRight className="h-8 w-8" />
                            ) : (
                              <ToggleLeft className="h-8 w-8 text-[var(--text-faint)]" />
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl bg-[var(--bg-muted)]/60 p-4 text-xs leading-relaxed text-[var(--text-muted)]">
                <p className="mb-2 font-medium text-[var(--text)]">How rules stack</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    <strong>Percentage</strong> — cut of sale total (e.g. 30% on services)
                  </li>
                  <li>
                    <strong>Fixed</strong> — flat bonus for each eligible item sold (e.g. RM5 campaign)
                  </li>
                  <li>
                    <strong>Service / Product</strong> — boosted rate on specific items
                  </li>
                  <li>
                    <strong>Override</strong> — a Percentage or Fixed rule with
                    a staff override and &ldquo;Applies To: All&rdquo; replaces
                    that barber&apos;s default rate entirely
                  </li>
                  <li>
                    A staff override on a <strong>Service / Product</strong>{" "}
                    rule instead adds on top as a bonus for that item, on top
                    of their normal rate on everything else
                  </li>
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[var(--gold)]" />
                  Staff Leaderboard
                </CardTitle>
                <span className="text-sm text-[var(--text-muted)]">From live sales</span>
              </CardHeader>
              <div className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <motion.div
                    key={entry.staff.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 p-3"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ${
                        i === 0
                          ? "gold-gradient text-[#0c0b09]"
                          : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 font-display text-xs font-semibold text-[var(--gold-soft)]">
                      {initials(entry.staff.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{entry.staff.name}</p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {entry.count} sales · {formatCurrency(entry.sales)} revenue
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-semibold text-[var(--gold-soft)]">
                        {formatCurrency(entry.commission)}
                      </p>
                      <p className="text-[10px] text-[var(--text-faint)]">commission</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[var(--gold)]" />
                Commission Payouts
              </CardTitle>
              <span className="text-sm text-[var(--text-muted)]">Lifetime, every branch</span>
            </CardHeader>
            <div className="space-y-3">
              {barbers.map((b) => {
                const entry = ledger[b.id] ?? { earned: 0, paid: 0, owed: 0 };
                return (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 font-display text-xs font-semibold text-[var(--gold-soft)]">
                      {initials(b.name)}
                    </div>
                    <p className="min-w-0 flex-1 truncate font-medium">{b.name}</p>
                    <div className="flex gap-4 text-right text-xs">
                      <div>
                        <p className="font-display font-semibold">{formatCurrency(entry.earned)}</p>
                        <p className="text-[10px] text-[var(--text-faint)]">earned</p>
                      </div>
                      <div>
                        <p className="font-display font-semibold">{formatCurrency(entry.paid)}</p>
                        <p className="text-[10px] text-[var(--text-faint)]">paid</p>
                      </div>
                      <div>
                        <p className="font-display font-semibold text-[var(--gold-soft)]">
                          {formatCurrency(entry.owed)}
                        </p>
                        <p className="text-[10px] text-[var(--text-faint)]">owed</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={entry.owed <= 0}
                      onClick={() => openPayout(b.id, b.name)}
                    >
                      Mark Paid
                    </Button>
                  </div>
                );
              })}
              {barbers.length === 0 && (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                  No barbers at this branch yet.
                </p>
              )}
            </div>
          </Card>
        </div>
      </PageTransition>

      <Modal
        open={ruleModalOpen}
        onOpenChange={(open) => {
          setRuleModalOpen(open);
          if (!open) setEditingRuleId(null);
        }}
        title={editingRuleId ? "Edit Commission Rule" : "Add Commission Rule"}
        description="Configure how staff earn on sales"
      >
        <form onSubmit={handleSubmitRule} className="space-y-4">
          <div>
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Service Default"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="rule-type">Type</Label>
              <Select
                id="rule-type"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as CommissionType,
                  }))
                }
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
                <option value="service-based">Service-based</option>
                <option value="product-based">Product-based</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-value">
                Value {form.type === "fixed" ? "(RM)" : "(%)"}
              </Label>
              <Input
                id="rule-value"
                type="number"
                min={0}
                max={form.type === "fixed" ? undefined : 100}
                step={form.type === "fixed" ? "1" : "0.1"}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="rule-applies">Applies To</Label>
            <Select
              id="rule-applies"
              value={form.appliesTo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  appliesTo: e.target.value as CommissionRule["appliesTo"],
                }))
              }
            >
              <option value="all">All</option>
              <option value="service">Service</option>
              <option value="product">Product</option>
            </Select>
          </div>
          {showServicePicker && (
            <div>
              <Label htmlFor="rule-service">Service (optional)</Label>
              <Select
                id="rule-service"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              >
                <option value="">Any service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {showProductPicker && (
            <div>
              <Label htmlFor="rule-product">Product (optional)</Label>
              <Select
                id="rule-product"
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              >
                <option value="">Any product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="rule-staff">Staff Override (optional)</Label>
            <Select
              id="rule-staff"
              value={form.staffId}
              onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
            >
              <option value="">All barbers</option>
              {barbers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded border-[var(--border)] bg-[var(--bg-muted)] accent-[var(--gold)]"
            />
            {editingRuleId ? "Active" : "Active on creation"}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRuleModalOpen(false);
                setEditingRuleId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">{editingRuleId ? "Save Rule" : "Add Rule"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!payoutFor}
        onOpenChange={(open) => !open && setPayoutFor(null)}
        title={payoutFor ? `Pay ${payoutFor.name}` : ""}
        description={payoutFor ? `${formatCurrency(payoutFor.owed)} owed` : ""}
      >
        {payoutFor && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="payout-amount">Amount (RM)</Label>
              <Input
                id="payout-amount"
                type="number"
                min={0}
                max={payoutFor.owed}
                step={0.01}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="payout-note">Note (optional)</Label>
              <Input
                id="payout-note"
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder="e.g. Paid via bank transfer"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPayoutFor(null)}>
                Cancel
              </Button>
              <Button onClick={confirmPayout} disabled={payingOut}>
                {payingOut ? "Paying…" : "Mark Paid"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
