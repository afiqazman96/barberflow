"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  DollarSign,
  ExternalLink,
  FlaskConical,
  HeadphonesIcon,
  Plus,
  Users,
} from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StatCard } from "@/components/domain/stat-card";
import { SalesChart } from "@/components/domain/charts";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { SALES_TREND } from "@/lib/mock/data";
import { usePlatformStore } from "@/lib/store/platform-store";
import { formatCurrency, formatDate } from "@/lib/utils";

function planVariant(plan: string): "gold" | "info" | "default" {
  if (plan === "Enterprise") return "gold";
  if (plan === "Growth") return "info";
  return "default";
}

export default function SuperAdminDashboardPage() {
  const tenants = usePlatformStore((s) => s.tenants);
  const totalMrr = usePlatformStore((s) => s.totalMrr);
  const trialCount = usePlatformStore((s) => s.trialCount);
  const openTicketCount = usePlatformStore((s) => s.openTicketCount);

  const mrr = totalMrr();
  const trials = trialCount();
  const openTickets = openTicketCount();
  const activeTenants = tenants.filter((t) => t.status === "active").length;

  const recentTenants = useMemo(
    () =>
      [...tenants]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 5),
    [tenants],
  );

  const avgMrr =
    activeTenants > 0 ? Math.round((mrr / activeTenants) * 100) / 100 : 0;

  return (
    <>
      <Topbar
        title="Dashboard"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            Platform Overview
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm">
              <Link href="/super-admin/tenant">
                <Plus className="h-4 w-4" />
                Add Tenant
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/pricing">
                <ExternalLink className="h-4 w-4" />
                Owner Pricing Page
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Tenants"
              value={String(tenants.length)}
              change={`${activeTenants} active`}
              trend="up"
              icon={Building2}
              delay={0}
            />
            <StatCard
              label="MRR"
              value={formatCurrency(mrr)}
              change={`Avg ${formatCurrency(avgMrr)}/tenant`}
              trend="up"
              icon={DollarSign}
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
              label="Open Tickets"
              value={String(openTickets)}
              change="Needs attention"
              trend={openTickets > 2 ? "down" : "neutral"}
              icon={HeadphonesIcon}
              delay={0.15}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesChart
                data={SALES_TREND}
                title="Platform revenue trend (demo)"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[var(--gold)]" />
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  <Button asChild variant="secondary" className="w-full justify-start">
                    <Link href="/super-admin/tenant">
                      <Plus className="h-4 w-4" />
                      Add tenant
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full justify-start">
                    <Link href="/pricing">
                      <ExternalLink className="h-4 w-4" />
                      Pricing page for owners
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href="/super-admin/subscription">
                      View subscriptions
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full justify-start">
                    <Link href="/super-admin/support">
                      Support queue
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex w-full items-center justify-between">
                <CardTitle>Recent Tenants</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/super-admin/tenant">
                    View all
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                    <th className="pb-3 pr-4 font-medium">Tenant</th>
                    <th className="pb-3 pr-4 font-medium">Owner</th>
                    <th className="pb-3 pr-4 font-medium">Plan</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">MRR</th>
                    <th className="pb-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="border-b border-[var(--border)]/50 last:border-0"
                    >
                      <td className="py-3.5 pr-4">
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {tenant.slug}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-[var(--text-muted)]">
                        {tenant.ownerEmail}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge variant={planVariant(tenant.plan)}>
                          {tenant.plan}
                        </Badge>
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        {tenant.mrr > 0
                          ? formatCurrency(tenant.mrr)
                          : "—"}
                      </td>
                      <td className="py-3.5 text-[var(--text-muted)]">
                        {formatDate(tenant.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageTransition>
    </>
  );
}
