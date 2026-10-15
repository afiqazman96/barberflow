"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { PillTabs } from "@/components/ui/pill-tabs";
import { downloadInvoicePdf } from "@/lib/billing/invoice-pdf";
import { usePlatformStore } from "@/lib/store/platform-store";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type StatusFilter = "all" | Invoice["status"];

/** Left-edge accent colour per invoice status — same idea as the tenant table. */
const ROW_ACCENT: Record<Invoice["status"], string> = {
  pending: "var(--warning)",
  paid: "var(--success)",
  overdue: "var(--danger)",
};

function periodLabel(period: string) {
  return new Date(period).toLocaleDateString("en-MY", {
    month: "long",
    year: "numeric",
  });
}

export default function SuperAdminInvoicesPage() {
  const invoices = usePlatformStore((s) => s.invoices);
  const markInvoicePaid = usePlatformStore((s) => s.markInvoicePaid);
  const remindInvoice = usePlatformStore((s) => s.remindInvoice);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? invoices
        : invoices.filter((i) => i.status === statusFilter),
    [invoices, statusFilter],
  );

  const outstanding = useMemo(
    () =>
      invoices
        .filter((i) => i.status !== "paid")
        .reduce((sum, i) => sum + i.amount, 0),
    [invoices],
  );
  const pendingCount = invoices.filter((i) => i.status === "pending").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const paidCount = invoices.filter((i) => i.status === "paid").length;

  async function handleMarkPaid(invoiceId: string) {
    const result = await markInvoicePaid(invoiceId);
    if (!result.ok) {
      toast.error("Could not mark this paid", { description: result.error });
      return;
    }
    toast.success("Invoice marked as paid");
  }

  async function handleRemind(invoiceId: string) {
    const result = await remindInvoice(invoiceId);
    if (!result.ok) {
      toast.error("Could not send reminder", { description: result.error });
      return;
    }
    toast.success("Reminder sent", {
      description: "The owner will see it on their notification bell",
    });
  }

  return (
    <>
      <Topbar
        title="Invoices"
        actions={
          <span className="hidden text-xs text-[var(--text-faint)] sm:block">
            {formatCurrency(outstanding)} outstanding
          </span>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total", value: invoices.length },
              { label: "Pending", value: pendingCount },
              { label: "Overdue", value: overdueCount },
              { label: "Paid", value: paidCount },
            ].map((tile) => (
              <div
                key={tile.label}
                className="card-surface flex flex-col items-center gap-0.5 py-4 text-center"
              >
                <p className="font-display text-2xl font-bold">{tile.value}</p>
                <p className="text-xs text-[var(--text-faint)]">{tile.label}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex w-full flex-col gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[var(--gold)]" />
                  All Invoices
                </CardTitle>
                <PillTabs
                  tabs={[
                    { value: "all", label: "All statuses", count: invoices.length },
                    { value: "pending", label: "Pending", count: pendingCount },
                    { value: "overdue", label: "Overdue", count: overdueCount },
                    { value: "paid", label: "Paid", count: paidCount },
                  ]}
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as StatusFilter)}
                />
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                    <th className="pb-3 pl-3 pr-4 font-medium">Tenant</th>
                    <th className="pb-3 pr-4 font-medium">Period</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Due / Paid</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((invoice, i) => (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--bg-muted)]/30"
                      style={{
                        boxShadow: `inset 3px 0 0 ${ROW_ACCENT[invoice.status]}`,
                      }}
                    >
                      <td className="py-3.5 pl-3 pr-4 font-medium">
                        {invoice.tenantName}
                      </td>
                      <td className="py-3.5 pr-4 text-[var(--text-muted)]">
                        {periodLabel(invoice.period)}
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="py-3.5 pr-4 text-[var(--text-muted)]">
                        {invoice.paidAt
                          ? `Paid ${formatDate(invoice.paidAt)}`
                          : formatDate(invoice.dueAt)}
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadInvoicePdf(invoice)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {invoice.status !== "paid" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemind(invoice.id)}
                              >
                                <Bell className="h-4 w-4" />
                                Remind
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleMarkPaid(invoice.id)}
                              >
                                Mark as Paid
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-[var(--text-muted)]"
                      >
                        No invoices match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageTransition>
    </>
  );
}
