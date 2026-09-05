"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Receipt as ReceiptIcon, Printer, Ban } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useSession } from "@/components/auth/session-provider";
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
  const session = useSession();
  const isOwner = session.role === "owner";
  const sales = useAppStore((s) => s.sales);
  const business = useAppStore((s) => s.businessProfile);
  const voidSale = useAppStore((s) => s.voidSale);

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<"all" | PaymentMethod>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const selected = selectedId
    ? (sales.find((s) => s.id === selectedId) ?? null)
    : null;

  function handleVoid() {
    if (!selected) return;
    if (!voidReason) {
      toast.error("Pick a reason for the void");
      return;
    }
    voidSale(selected.id, voidReason, session.name);
    toast.success("Sale voided", {
      description: `${selected.receiptNo} · ${voidReason}`,
    });
    setVoidOpen(false);
    setVoidReason("");
  }

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

  const totalShown = filtered
    .filter((s) => !s.voided)
    .reduce((sum, s) => sum + s.total, 0);

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
                onClick={() => setSelectedId(sale.id)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-[var(--bg-muted)] md:grid md:grid-cols-[auto_1fr_auto_auto_auto]"
              >
                <span className="w-24 shrink-0">
                  <Badge variant={sale.voided ? "default" : "gold"}>
                    {sale.receiptNo}
                  </Badge>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {sale.customerName}
                    {sale.voided && (
                      <span className="rounded bg-[var(--danger)]/12 px-1.5 text-[10px] font-semibold uppercase text-[var(--danger)]">
                        Voided
                      </span>
                    )}
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
                <span
                  className={`w-24 shrink-0 text-right font-display text-sm font-semibold ${
                    sale.voided
                      ? "text-[var(--text-faint)] line-through"
                      : ""
                  }`}
                >
                  {formatCurrency(sale.total)}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelectedId(null)}
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
              {selected.voided && (
                <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3 py-2 text-xs text-[var(--danger)]">
                  <span className="font-semibold uppercase">Voided</span> ·{" "}
                  {selected.voided.reason} · by {selected.voided.by} ·{" "}
                  {formatDateTime(selected.voided.at)}
                </div>
              )}
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
                    <span>
                      Discount
                      {selected.discountReason &&
                        ` · ${selected.discountReason}`}
                    </span>
                    <span>-{formatCurrency(selected.discount)}</span>
                  </div>
                )}
                {selected.tip > 0 && (
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <span>+{formatCurrency(selected.tip)}</span>
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
                    Barber got:{" "}
                    {formatCurrency(selected.commission + selected.tip)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handlePrint(selected)}
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                {isOwner && !selected.voided && (
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => setVoidOpen(true)}
                  >
                    <Ban className="h-4 w-4" />
                    Void sale
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void this sale?"
        description={
          selected
            ? `${selected.receiptNo} · ${formatCurrency(selected.total)}. This reverses the barber's takings, restocks products, and logs a cash refund.`
            : ""
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Reason</Label>
            <Select
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            >
              <option value="">Select a reason…</option>
              <option value="Wrong item rung up">Wrong item rung up</option>
              <option value="Wrong price">Wrong price</option>
              <option value="Duplicate charge">Duplicate charge</option>
              <option value="Customer refund">Customer refund</option>
              <option value="Test transaction">Test transaction</option>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setVoidOpen(false)}
            >
              Keep sale
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleVoid}>
              Void sale
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
