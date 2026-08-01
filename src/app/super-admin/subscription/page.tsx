"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  FlaskConical,
  RefreshCw,
  Users,
  Ban,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatCard } from "@/components/domain/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePlatformStore } from "@/lib/store/platform-store";
import type { Tenant } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

function planVariant(plan: string): "gold" | "info" | "default" {
  if (plan === "Enterprise") return "gold";
  if (plan === "Growth") return "info";
  return "default";
}

export default function SuperAdminSubscriptionPage() {
  const tenants = usePlatformStore((s) => s.tenants);
  const packages = usePlatformStore((s) => s.packages);
  const totalMrr = usePlatformStore((s) => s.totalMrr);
  const trialCount = usePlatformStore((s) => s.trialCount);
  const changeTenantPlan = usePlatformStore((s) => s.changeTenantPlan);
  const convertTrialToActive = usePlatformStore((s) => s.convertTrialToActive);
  const suspendTenant = usePlatformStore((s) => s.suspendTenant);

  const [planModal, setPlanModal] = useState<Tenant | null>(null);
  const [planForm, setPlanForm] = useState({
    packageId: "",
    billing: "monthly" as "monthly" | "yearly",
  });

  const mrr = totalMrr();
  const trials = trialCount();
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;

  const mrrByPackage = useMemo(() => {
    return packages.map((pkg) => {
      const subs = tenants.filter(
        (t) => t.packageId === pkg.id && t.status === "active",
      );
      return {
        packageId: pkg.id,
        name: pkg.name,
        mrr: subs.reduce((sum, t) => sum + t.mrr, 0),
        count: subs.length,
      };
    });
  }, [packages, tenants]);

  const subscriptions = useMemo(
    () =>
      [...tenants].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [tenants],
  );

  function openChangePlan(tenant: Tenant) {
    setPlanModal(tenant);
    setPlanForm({ packageId: tenant.packageId, billing: tenant.billing });
  }

  function handleChangePlan() {
    if (!planModal) return;
    changeTenantPlan(planModal.id, planForm.packageId, planForm.billing);
    toast.success("Plan updated", { description: planModal.name });
    setPlanModal(null);
  }

  function handleConvert(tenant: Tenant) {
    convertTrialToActive(tenant.id);
    toast.success("Trial converted to active", { description: tenant.name });
  }

  function handleSuspend(tenant: Tenant) {
    suspendTenant(tenant.id);
    toast.success("Subscription suspended", { description: tenant.name });
  }

  return (
    <>
      <Topbar
        title="Subscription"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            Billing Overview
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <Card className="border-[var(--gold)]/20 bg-[var(--gold)]/5">
            <p className="p-4 text-sm text-[var(--text-muted)]">
              Shop owners choose a plan on the{" "}
              <span className="font-medium text-[var(--gold-soft)]">
                Pricing
              </span>{" "}
              page, start a trial, then pay to become an active subscriber.
              MRR is calculated automatically from package pricing and billing
              cycle when a tenant converts from trial or is onboarded as active.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total MRR"
              value={formatCurrency(mrr)}
              change={`${activeCount} paying tenants`}
              trend="up"
              icon={CreditCard}
              delay={0}
            />
            <StatCard
              label="Active Subscriptions"
              value={String(activeCount)}
              change={`${trials} on trial`}
              trend="neutral"
              icon={Users}
              delay={0.05}
            />
            <StatCard
              label="Active Trials"
              value={String(trials)}
              change="Pre-conversion"
              trend="neutral"
              icon={FlaskConical}
              delay={0.1}
            />
            <StatCard
              label="Suspended"
              value={String(suspendedCount)}
              change="No MRR counted"
              trend={suspendedCount > 0 ? "down" : "neutral"}
              icon={Ban}
              delay={0.15}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-[var(--gold)]" />
                  MRR by Package
                </CardTitle>
              </CardHeader>
              <div className="space-y-4">
                {mrrByPackage.map((item, i) => {
                  const pct =
                    mrr > 0 ? Math.round((item.mrr / mrr) * 100) : 0;
                  return (
                    <motion.div
                      key={item.packageId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                    >
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={planVariant(item.name)}>
                            {item.name}
                          </Badge>
                          <span className="text-[var(--text-faint)]">
                            {item.count} active
                          </span>
                        </div>
                        <span className="font-medium">
                          {formatCurrency(item.mrr)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <motion.div
                          className="h-full rounded-full gold-gradient"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-[var(--text-faint)]">
                        {pct}% of total MRR
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>All Subscriptions</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="pb-3 pr-4 font-medium">Tenant</th>
                      <th className="pb-3 pr-4 font-medium">Plan</th>
                      <th className="pb-3 pr-4 font-medium">Billing</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 pr-4 font-medium">MRR</th>
                      <th className="pb-3 pr-4 font-medium">Trial End</th>
                      <th className="pb-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((tenant, i) => (
                      <motion.tr
                        key={tenant.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.04 }}
                        className="border-b border-[var(--border)]/50 last:border-0"
                      >
                        <td className="py-3.5 pr-4 font-medium">
                          {tenant.name}
                        </td>
                        <td className="py-3.5 pr-4">
                          <Badge variant={planVariant(tenant.plan)}>
                            {tenant.plan}
                          </Badge>
                        </td>
                        <td className="py-3.5 pr-4 capitalize text-[var(--text-muted)]">
                          {tenant.billing}
                        </td>
                        <td className="py-3.5 pr-4">
                          <StatusBadge status={tenant.status} />
                        </td>
                        <td className="py-3.5 pr-4 font-medium">
                          {tenant.mrr > 0
                            ? formatCurrency(tenant.mrr)
                            : "—"}
                        </td>
                        <td className="py-3.5 pr-4 text-[var(--text-muted)]">
                          {tenant.trialEndsAt
                            ? formatDate(tenant.trialEndsAt)
                            : "—"}
                        </td>
                        <td className="py-3.5">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openChangePlan(tenant)}
                            >
                              Plan
                            </Button>
                            {tenant.status === "trial" && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleConvert(tenant)}
                              >
                                Convert
                              </Button>
                            )}
                            {tenant.status !== "suspended" && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleSuspend(tenant)}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>

      <Modal
        open={!!planModal}
        onOpenChange={(open) => !open && setPlanModal(null)}
        title="Change Plan"
        description={planModal ? `Update subscription for ${planModal.name}` : ""}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Label>Package</Label>
            <Select
              value={planForm.packageId}
              onChange={(e) =>
                setPlanForm({ ...planForm, packageId: e.target.value })
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
            <Label>Billing Cycle</Label>
            <Select
              value={planForm.billing}
              onChange={(e) =>
                setPlanForm({
                  ...planForm,
                  billing: e.target.value as "monthly" | "yearly",
                })
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleChangePlan}>
            Update Plan
          </Button>
        </div>
      </Modal>
    </>
  );
}
