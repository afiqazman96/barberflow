"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Receipt as ReceiptIcon, Printer } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import type { PaymentMethod, Sale } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const METHOD_FILTERS: { id: "all" | PaymentMethod; label: string }[] = [
  { id: "all", label: "All" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "qr", label: "QR" },
];

export function SalesHistory() {
  const sales = useAppStore((s) => s.sales);
  const business = useAppStore((s) => s.businessProfile);

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [selected, setSelected] = useState<Sale | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...sales]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((s) => {
        const matchMethod = method === "all" || s.paymentMethod === method;
        const matchSearch =
          !q ||
          s.receiptNo.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.staffName.toLowerCase().includes(q);
        return matchMethod && matchSearch;
      });
  }, [sales, search, method]);

  const totalShown = filtered.reduce((sum, s) => sum + s.total, 0);

  function handlePrint(sale: Sale) {
    toast.success("Receipt sent to printer", {
      description: `${sale.receiptNo} — mock print`,
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <Input
            className="pl-10"
            placeholder="Search receipt no, customer, or barber…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
          {METHOD_FILTERS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                method === m.id
                  ? "bg-[var(--bg-elevated)] text-[var(--text)] shadow-[var(--shadow-soft)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--text-faint)]">
        <span>{filtered.length} receipt(s)</span>
        <span>Total: {formatCurrency(totalShown)}</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <ReceiptIcon className="mx-auto h-10 w-10 text-[var(--text-faint)]" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No receipts match your search.
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="hidden grid-cols-[auto_1fr_auto_auto_auto] gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--text-faint)] md:grid">
            <span className="w-24">Receipt</span>
            <span>Customer</span>
            <span className="w-32">Date / Time</span>
            <span className="w-16 text-center">Pay</span>
            <span className="w-24 text-right">Total</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((sale, i) => (
              <motion.button
                key={sale.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                onClick={() => setSelected(sale)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[var(--bg-muted)] md:grid md:grid-cols-[auto_1fr_auto_auto_auto]"
              >
                <span className="w-24 shrink-0">
                  <Badge variant="gold">{sale.receiptNo}</Badge>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {sale.customerName}
                  </p>
                  <p className="truncate text-xs text-[var(--text-faint)]">
                    {sale.items.map((it) => it.name).join(" · ")}
                  </p>
                </div>
                <span className="hidden w-32 text-xs text-[var(--text-muted)] md:block">
                  {formatDateTime(sale.createdAt)}
                </span>
                <span className="hidden w-16 text-center text-xs uppercase text-[var(--text-muted)] md:block">
                  {sale.paymentMethod}
                </span>
                <span className="w-24 shrink-0 text-right font-display text-sm font-semibold">
                  {formatCurrency(sale.total)}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        className="max-w-md"
      >
        {selected && (
          <div>
            <div className="-mx-6 -mt-6 mb-4 border-b border-[var(--border)] bg-[var(--bg-muted)] px-5 py-4 text-center">
              <p className="font-display text-lg font-bold">{business.name}</p>
              <p className="text-xs text-[var(--text-faint)]">
                {business.address} · {business.phone}
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Receipt</span>
                <Badge variant="gold">{selected.receiptNo}</Badge>
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                <p>{selected.customerName}</p>
                <p>Barber: {selected.staffName}</p>
                <p>{formatDateTime(selected.createdAt)}</p>
              </div>
              <div className="space-y-2 border-y border-dashed border-[var(--border)] py-4">
                {selected.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selected.subtotal)}</span>
                </div>
                {selected.discount > 0 && (
                  <div className="flex justify-between text-[var(--success)]">
                    <span>Discount</span>
                    <span>-{formatCurrency(selected.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-[var(--gold-soft)]">
                    {formatCurrency(selected.total)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--text-faint)]">
                  <span className="capitalize">{selected.paymentMethod}</span>
                  <span>
                    Commission: {formatCurrency(selected.commission)}
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handlePrint(selected)}
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
