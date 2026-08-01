"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { History, Receipt, Scissors } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useStaffPortal } from "@/hooks/use-staff-portal";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type HistoryEntry =
  | { kind: "sale"; id: string; at: string; node: React.ReactNode }
  | { kind: "queue"; id: string; at: string; node: React.ReactNode };

export default function StaffHistoryPage() {
  const { staff, staffSales, historyTickets } = useStaffPortal();

  const timeline = useMemo(() => {
    const entries: HistoryEntry[] = [
      ...staffSales.map((sale) => ({
        kind: "sale" as const,
        id: sale.id,
        at: sale.createdAt,
        node: (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                <p className="truncate font-medium">{sale.customerName}</p>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {sale.items.map((i) => i.name).join(" · ")}
              </p>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                {sale.receiptNo} · {sale.paymentMethod.toUpperCase()}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display font-semibold">{formatCurrency(sale.total)}</p>
              <p className="text-xs text-[var(--success)]">
                +{formatCurrency(sale.commission)}
              </p>
            </div>
          </div>
        ),
      })),
      ...historyTickets.map((ticket) => ({
        kind: "queue" as const,
        id: ticket.id,
        at: ticket.startedAt ?? ticket.createdAt,
        node: (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Scissors className="h-3.5 w-3.5 shrink-0 text-[var(--info)]" />
                <p className="truncate font-medium">{ticket.customerName}</p>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {ticket.serviceNames.join(" · ")}
              </p>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                Queue {ticket.number} · {ticket.source}
              </p>
            </div>
          </div>
        ),
      })),
    ];

    return entries.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [staffSales, historyTickets]);

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          Activity
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
          Service History
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Completed services & sales for {staff.name.split(" ")[0]}
        </p>
      </motion.header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            Completed
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-[var(--gold-soft)]">
            {historyTickets.filter((t) => t.status === "completed").length}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            Sales
          </p>
          <p className="mt-1 font-display text-2xl font-bold">
            {staffSales.length}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-[var(--gold)]" />
            Timeline
          </CardTitle>
        </CardHeader>
        {timeline.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">
            No history yet — your completed work will show here
          </p>
        ) : (
          <div className="relative space-y-0">
            <div className="absolute bottom-2 left-[11px] top-2 w-px bg-[var(--border)]" />
            {timeline.map((entry, i) => (
              <motion.div
                key={`${entry.kind}-${entry.id}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * i }}
                className="relative pb-4 pl-8 last:pb-0"
              >
                <div
                  className={`absolute left-0 top-3 h-[22px] w-[22px] rounded-full border-2 border-[var(--bg-card)] ${
                    entry.kind === "sale" ? "bg-[var(--gold)]" : "bg-[var(--info)]"
                  }`}
                />
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]/40 p-3">
                  {entry.node}
                  <p className="mt-2 text-[10px] text-[var(--text-faint)]">
                    {formatDateTime(entry.at)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
