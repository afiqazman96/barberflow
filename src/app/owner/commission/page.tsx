"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Info,
  Trophy,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
  Sparkles,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import type { CommissionRule, CommissionType, Service } from "@/lib/types";
import { formatCurrency, initials } from "@/lib/utils";

function ruleDescription(
  rule: CommissionRule,
  services: Service[],
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
      return `Extra ${rule.value}% on specific product`;
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

type AddRuleForm = {
  name: string;
  type: CommissionType;
  value: string;
  appliesTo: CommissionRule["appliesTo"];
  serviceId: string;
  staffId: string;
  active: boolean;
};

const emptyRuleForm = (): AddRuleForm => ({
  name: "",
  type: "percentage",
  value: "30",
  appliesTo: "service",
  serviceId: "",
  staffId: "",
  active: true,
});

export default function OwnerCommissionPage() {
  const commissionRules = useAppStore((s) => s.commissionRules);
  const updateCommissionRule = useAppStore((s) => s.updateCommissionRule);
  const addCommissionRule = useAppStore((s) => s.addCommissionRule);
  const sales = useAppStore((s) => s.sales);
  const staff = useAppStore((s) => s.staff);
  const services = useAppStore((s) => s.services);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddRuleForm>(emptyRuleForm);

  const barbers = useMemo(
    () => staff.filter((s) => s.role === "barber"),
    [staff],
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

  function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }

    const rule = addCommissionRule({
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value) || 0,
      appliesTo: form.appliesTo,
      serviceId: form.serviceId || undefined,
      staffId: form.staffId || undefined,
      active: form.active,
    });

    toast.success("Rule added", { description: rule.name });
    setAddOpen(false);
    setForm(emptyRuleForm());
  }

  const showServicePicker =
    form.type === "service-based" || form.appliesTo === "service";

  return (
    <>
      <Topbar
        title="Commission Engine"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Commission"
              value={formatCurrency(totalCommission)}
              change={`${sales.length} transactions`}
              trend="up"
              icon={DollarSign}
              delay={0}
            />
            <StatCard
              label="Active Rules"
              value={String(activeRules)}
              change={`${commissionRules.length} total configured`}
              trend="neutral"
              icon={Percent}
              delay={0.05}
            />
            <StatCard
              label="Top Earner"
              value={leaderboard[0]?.staff.name.split(" ")[0] ?? "—"}
              change={formatCurrency(leaderboard[0]?.commission ?? 0)}
              trend="up"
              icon={Trophy}
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
                      className={`rounded-xl border p-4 transition ${
                        rule.active
                          ? "border-[var(--gold)]/20 bg-[var(--gold)]/5"
                          : "border-[var(--border)] bg-[var(--bg-muted)]/40 opacity-70"
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
                              {ruleDescription(rule, services)}
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
                        <button
                          onClick={() => toggleRule(rule.id)}
                          className="shrink-0 text-[var(--gold)]"
                          aria-label={rule.active ? "Disable rule" : "Enable rule"}
                        >
                          {rule.active ? (
                            <ToggleRight className="h-8 w-8" />
                          ) : (
                            <ToggleLeft className="h-8 w-8 text-[var(--text-faint)]" />
                          )}
                        </button>
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
                    <strong>Fixed</strong> — flat bonus per transaction (e.g. RM5 campaign)
                  </li>
                  <li>
                    <strong>Service / Product</strong> — boosted rate on specific items
                  </li>
                  <li>
                    <strong>Override</strong> — per-staff rate replaces default for that barber
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
                    className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/50 p-3"
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
        </div>
      </PageTransition>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Commission Rule"
        description="Configure how staff earn on sales"
      >
        <form onSubmit={handleAddRule} className="space-y-4">
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
            Active on creation
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Rule</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
