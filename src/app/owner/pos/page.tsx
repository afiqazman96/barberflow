"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  Sparkles,
  ShoppingBag,
  User,
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import { CUSTOMERS } from "@/lib/mock/data";
import type { PaymentMethod } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type Tab = "services" | "products";

const METHODS: {
  id: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "qr", label: "QR Pay", icon: QrCode },
];

export default function OwnerPosPage() {
  const queue = useAppStore((s) => s.queue);
  const PRODUCTS = useAppStore((s) => s.products);
  const SERVICES = useAppStore((s) => s.services);
  const posItems = useAppStore((s) => s.posItems);
  const posDiscount = useAppStore((s) => s.posDiscount);
  const posCustomerId = useAppStore((s) => s.posCustomerId);
  const lastReceipt = useAppStore((s) => s.lastReceipt);
  const addPosItem = useAppStore((s) => s.addPosItem);
  const updatePosQty = useAppStore((s) => s.updatePosQty);
  const removePosItem = useAppStore((s) => s.removePosItem);
  const setPosDiscount = useAppStore((s) => s.setPosDiscount);
  const setPosCustomerId = useAppStore((s) => s.setPosCustomerId);
  const clearPos = useAppStore((s) => s.clearPos);
  const completePayment = useAppStore((s) => s.completePayment);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);

  const [tab, setTab] = useState<Tab>("services");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

  const customer = posCustomerId
    ? CUSTOMERS.find((c) => c.id === posCustomerId)
    : null;
  const customerName = customer?.name ?? null;
  const membership = customer?.membership ?? "none";

  const subtotal = posItems.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const total = Math.max(0, subtotal - posDiscount);
  const receipt = paid ? lastReceipt : null;

  const catalog = useMemo(() => {
    const items =
      tab === "services"
        ? SERVICES.map((s) => ({
            id: s.id,
            name: s.name,
            price: s.price,
            membershipPrice: s.membershipPrice,
            category: s.category,
            popular: s.popular,
            type: "service" as const,
          }))
        : PRODUCTS.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            stock: p.stock,
            type: "product" as const,
          }));

    if (!catalogSearch) return items;
    const q = catalogSearch.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [tab, catalogSearch]);

  function getPrice(item: (typeof catalog)[0]) {
    if (
      item.type === "service" &&
      "membershipPrice" in item &&
      membership !== "none"
    ) {
      return item.membershipPrice;
    }
    return item.price;
  }

  function handleAdd(item: (typeof catalog)[0]) {
    addPosItem({
      id: item.id,
      type: item.type,
      name: item.name,
      quantity: 1,
      unitPrice: getPrice(item),
    });
    toast.success("Added to cart", { description: item.name });
  }

  function openPayment() {
    if (posItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setPaid(false);
    setMethod(null);
    setPayOpen(true);
  }

  function handlePay() {
    if (!method) {
      toast.error("Select a payment method");
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      const sale = completePayment(method);
      const ticket = queue.find(
        (q) =>
          q.customerId === sale.customerId &&
          q.status === "awaiting-payment",
      );
      if (ticket) {
        updateQueueTicket(ticket.id, { status: "completed" });
      }
      setPaid(true);
      setProcessing(false);
      toast.success("Payment complete!", {
        description: `Receipt ${sale.receiptNo}`,
      });
    }, 800);
  }

  function handleClosePayment() {
    setPayOpen(false);
    if (paid) {
      setPaid(false);
      setMethod(null);
    }
  }

  function handlePrint() {
    toast.success("Receipt sent to printer", {
      description: "Mock print — Fade House KL",
    });
  }

  return (
    <>
      <Topbar
        title="Point of Sale"
        actions={
          posItems.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearPos}>
              Clear
            </Button>
          ) : null
        }
      />
      <PageTransition>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 p-4 lg:flex-row lg:p-6">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab("services")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  tab === "services"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Services
              </button>
              <button
                onClick={() => setTab("products")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  tab === "products"
                    ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                Products
              </button>
            </div>

            <Input
              placeholder={`Search ${tab}…`}
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {catalog.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleAdd(item)}
                  className="card-surface flex items-center justify-between p-4 text-left transition hover:border-[var(--gold)]/40 active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      {"popular" in item && item.popular && (
                        <Badge variant="gold">Popular</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-faint)]">
                      {item.category}
                      {"stock" in item && ` · ${item.stock} in stock`}
                    </p>
                  </div>
                  <p className="font-semibold text-[var(--gold-soft)]">
                    {formatCurrency(getPrice(item))}
                  </p>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-96">
            <Card className="sticky top-20 p-4">
              <CardHeader className="mb-3">
                <CardTitle>Cart</CardTitle>
              </CardHeader>

              <div className="mb-3">
                <Label>Customer (optional)</Label>
                <select
                  value={posCustomerId ?? ""}
                  onChange={(e) =>
                    setPosCustomerId(e.target.value || null)
                  }
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm"
                >
                  <option value="">Walk-in</option>
                  {CUSTOMERS.slice(0, 20).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {customerName && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-sm">
                  <User className="h-4 w-4 text-[var(--gold)]" />
                  <span>{customerName}</span>
                  {membership !== "none" && (
                    <Badge variant="gold" className="ml-auto capitalize">
                      {membership}
                    </Badge>
                  )}
                </div>
              )}

              {posItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                  Cart is empty. Add services or products.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {posItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-xl bg-[var(--bg-muted)] p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {formatCurrency(item.unitPrice)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updatePosQty(item.id, item.quantity - 1)}
                          className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updatePosQty(item.id, item.quantity + 1)}
                          className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removePosItem(item.id)}
                          className="rounded-lg p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                <div>
                  <Label>Discount (RM)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={posDiscount || ""}
                    onChange={(e) =>
                      setPosDiscount(Math.max(0, Number(e.target.value) || 0))
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {posDiscount > 0 && (
                    <div className="flex justify-between text-[var(--success)]">
                      <span>Discount</span>
                      <span>-{formatCurrency(posDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-[var(--gold-soft)]">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={openPayment}
                  disabled={posItems.length === 0}
                >
                  Pay {formatCurrency(total)}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>

      <Modal
        open={payOpen}
        onOpenChange={(open) => !open && handleClosePayment()}
        title={paid ? "Payment Successful" : "Complete Payment"}
        description={
          paid ? "Transaction completed" : formatCurrency(total)
        }
        className="max-w-md"
      >
        <AnimatePresence mode="wait">
          {!paid ? (
            <motion.div
              key="checkout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="space-y-2 text-sm">
                {posItems.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition ${
                        method === m.id
                          ? "bg-[var(--gold)]/15 ring-2 ring-[var(--gold)]/30"
                          : "bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${method === m.id ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}
                      />
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePay}
                disabled={!method || processing}
              >
                {processing ? "Processing…" : `Confirm · ${formatCurrency(total)}`}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/15">
                  <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
                </div>
              </div>
              {receipt && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Receipt</span>
                    <Badge variant="gold">{receipt.receiptNo}</Badge>
                  </div>
                  <p className="mt-2">{receipt.customerName}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {formatDateTime(receipt.createdAt)}
                  </p>
                  <p className="mt-3 font-display text-xl font-semibold text-[var(--gold-soft)]">
                    {formatCurrency(receipt.total)}
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button className="flex-1" onClick={handleClosePayment}>
                  Done
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </>
  );
}
