"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import { usePlatformStore } from "@/lib/store/platform-store";
import { formatCurrency, formatDate } from "@/lib/utils";

const TENANT_ID = "t1";

function usagePct(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function usageTone(pct: number): "ok" | "warn" | "danger" {
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warn";
  return "ok";
}

const toneBar: Record<ReturnType<typeof usageTone>, string> = {
  ok: "gold-gradient",
  warn: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
};

export default function OwnerBillingPage() {
  const branches = useAppStore((s) => s.branches);
  const staff = useAppStore((s) => s.staff);

  const tenants = usePlatformStore((s) => s.tenants);
  const packages = usePlatformStore((s) => s.packages);
  const changeTenantPlan = usePlatformStore((s) => s.changeTenantPlan);
  const convertTrialToActive = usePlatformStore((s) => s.convertTrialToActive);

  const tenant = useMemo(
    () => tenants.find((t) => t.id === TENANT_ID),
    [tenants],
  );
  const pkg = useMemo(
    () => packages.find((p) => p.id === tenant?.packageId),
    [packages, tenant?.packageId],
  );

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    packageId: tenant?.packageId ?? "",
    billing: (tenant?.billing ?? "monthly") as "monthly" | "yearly",
  });

  const branchCount = branches.length;
  const staffCount = staff.length;
  const branchPct = usagePct(branchCount, pkg?.maxBranches ?? 1);
  const staffPct = usagePct(staffCount, pkg?.maxStaff ?? 1);

  function openUpgrade() {
    if (!tenant) return;
    setPlanForm({ packageId: tenant.packageId, billing: tenant.billing });
    setUpgradeOpen(true);
  }

  function handleUpgrade() {
    if (!tenant) return;
    changeTenantPlan(tenant.id, planForm.packageId, planForm.billing);
    const nextPkg = packages.find((p) => p.id === planForm.packageId);
    toast.success("Plan updated", {
      description: nextPkg ? `Now on ${nextPkg.name}` : undefined,
    });
    setUpgradeOpen(false);
  }

  function handleConvertTrial() {
    if (!tenant) return;
    convertTrialToActive(tenant.id);
    toast.success("Trial converted", {
      description: "Your subscription is now active",
    });
  }

  if (!tenant || !pkg) {
    return (
      <>
        <Topbar title="Billing" />
        <PageTransition>
          <div className="mx-auto max-w-3xl p-6">
            <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
              Subscription data unavailable. Contact support.
            </Card>
          </div>
        </PageTransition>
      </>
    );
  }

  const isTrial = tenant.status === "trial";

  return (
    <>
      <Topbar
        title="Billing & Subscription"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing">
              <ExternalLink className="h-4 w-4" />
              View plans
            </Link>
          </Button>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-gradient-to-br from-[var(--gold)]/10 via-[var(--bg-card)] to-[var(--bg-card)] p-6 md:p-8"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[var(--gold)]/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
                  {tenant.name}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                  {pkg.name}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      tenant.status === "active"
                        ? "success"
                        : tenant.status === "trial"
                          ? "info"
                          : "default"
                    }
                  >
                    {tenant.status}
                  </Badge>
                  <span className="text-sm capitalize text-[var(--text-muted)]">
                    {tenant.billing} billing
                  </span>
                </div>
                {isTrial && tenant.trialEndsAt && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <FlaskConical className="h-4 w-4 text-[var(--gold)]" />
                    Trial ends {formatDate(tenant.trialEndsAt)}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/60 px-5 py-4 text-right">
                <p className="text-xs text-[var(--text-faint)]">Monthly recurring</p>
                <p className="font-display text-3xl font-bold text-[var(--gold-soft)]">
                  {formatCurrency(tenant.mrr)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  {isTrial ? "Charged after trial" : "Billed automatically"}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[var(--gold)]" />
                  <CardTitle className="text-base">Branches</CardTitle>
                </div>
                <span className="text-sm font-medium">
                  {branchCount} / {pkg.maxBranches}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className={`h-full rounded-full transition-all ${toneBar[usageTone(branchPct)]}`}
                  style={{ width: `${branchPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-faint)]">
                {branchPct}% of plan limit used
              </p>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--gold)]" />
                  <CardTitle className="text-base">Staff seats</CardTitle>
                </div>
                <span className="text-sm font-medium">
                  {staffCount} / {pkg.maxStaff}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className={`h-full rounded-full transition-all ${toneBar[usageTone(staffPct)]}`}
                  style={{ width: `${staffPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-faint)]">
                {staffPct}% of plan limit used
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                Plan includes
              </CardTitle>
            </CardHeader>
            <ul className="grid gap-2 sm:grid-cols-2">
              {pkg.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button onClick={openUpgrade}>
              <CreditCard className="h-4 w-4" />
              Upgrade plan
            </Button>
            {isTrial && (
              <Button variant="secondary" onClick={handleConvertTrial}>
                <FlaskConical className="h-4 w-4" />
                Convert trial to paid
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/pricing">Compare all plans</Link>
            </Button>
          </div>
        </div>
      </PageTransition>

      <Modal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Change plan"
        description={`Update subscription for ${tenant.name}`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="billing-plan">Package</Label>
            <Select
              id="billing-plan"
              value={planForm.packageId}
              onChange={(e) =>
                setPlanForm((f) => ({ ...f, packageId: e.target.value }))
              }
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)}/mo
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="billing-cycle">Billing cycle</Label>
            <Select
              id="billing-cycle"
              value={planForm.billing}
              onChange={(e) =>
                setPlanForm((f) => ({
                  ...f,
                  billing: e.target.value as "monthly" | "yearly",
                }))
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly (save ~17%)</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade}>Confirm change</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
