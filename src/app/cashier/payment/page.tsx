"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  CreditCard,
  QrCode,
  Printer,
  CheckCircle2,
  ShoppingCart,
  ArrowLeft,
  HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import type { PaymentMethod } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const METHODS: {
  id: PaymentMethod;
  label: string;
  icon: typeof Banknote;
  desc: string;
}[] = [
  { id: "cash", label: "Cash", icon: Banknote, desc: "Accept cash payment" },
  { id: "card", label: "Card", icon: CreditCard, desc: "Debit / credit card" },
  { id: "qr", label: "QR Pay", icon: QrCode, desc: "DuitNow / e-wallet" },
];

export default function CashierPaymentPage() {
  const router = useRouter();
  const posItems = useAppStore((s) => s.posItems);
  const posDiscount = useAppStore((s) => s.posDiscount);
  const posDiscountMode = useAppStore((s) => s.posDiscountMode);
  const posTip = useAppStore((s) => s.posTip);
  const setPosTip = useAppStore((s) => s.setPosTip);
  const posMembershipPlanId = useAppStore((s) => s.posMembershipPlanId);
  const membershipPlans = useAppStore((s) => s.membershipPlans);
  const drawerSession = useAppStore((s) => s.drawerSession);
  const lastReceipt = useAppStore((s) => s.lastReceipt);
  const completePayment = useAppStore((s) => s.completePayment);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paid, setPaid] = useState(false);
  const [processing, setProcessing] = useState(false);

  const upsellPlan = posMembershipPlanId
    ? membershipPlans.find((p) => p.id === posMembershipPlanId)
    : null;
  const subtotal =
    posItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) +
    (upsellPlan?.price ?? 0);
  const discountValue =
    posDiscountMode === "percent"
      ? Math.round(((subtotal * posDiscount) / 100) * 100) / 100
      : posDiscount;
  const goodsTotal = Math.max(0, subtotal - discountValue);
  const total = goodsTotal + posTip;
  const receipt = paid ? lastReceipt : null;

  const TIP_PCTS = [0, 10, 15, 20];

  function handlePay() {
    if (!method) {
      toast.error("Select a payment method");
      return;
    }
    if (posItems.length === 0 && !paid) {
      toast.error("No items to pay. Go to POS first.");
      return;
    }
    if (method === "cash" && !drawerSession) {
      toast.error("Open the cash drawer before taking cash", {
        description: "Cashier → Cash Drawer",
      });
      return;
    }

    setProcessing(true);
    setTimeout(() => {
      // completePayment records the sale, frees the barber and closes the
      // queue ticket in one step.
      const sale = completePayment(method);
      setPaid(true);
      setProcessing(false);
      toast.success("Payment complete!", {
        description: `Receipt ${sale.receiptNo}`,
      });
    }, 800);
  }

  function handlePrint() {
    toast.success("Receipt sent to printer", {
      description: "Mock print — Fade House KL receipt",
    });
  }

  function handleNewSale() {
    setPaid(false);
    setMethod(null);
    router.push("/cashier/pos");
  }

  return (
    <>
      <Topbar
        title="Payment"
        actions={
          !paid && posItems.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/cashier/pos">
                <ArrowLeft className="h-4 w-4" />
                Edit Cart
              </Link>
            </Button>
          ) : null
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
          <AnimatePresence mode="wait">
            {!paid ? (
              <motion.div
                key="checkout"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                {posItems.length === 0 ? (
                  <Card className="py-12 text-center">
                    <ShoppingCart className="mx-auto h-12 w-12 text-[var(--text-faint)]" />
                    <p className="mt-4 text-[var(--text-muted)]">
                      No active sale. Add items in POS first.
                    </p>
                    <Button asChild className="mt-4">
                      <Link href="/cashier/pos">Open POS</Link>
                    </Button>
                  </Card>
                ) : (
                  <>
                    <Card className="p-4">
                      <CardHeader className="mb-3">
                        <CardTitle>Order Summary</CardTitle>
                      </CardHeader>
                      <div className="space-y-2">
                        {posItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-sm"
                          >
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span>
                              {formatCurrency(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {upsellPlan && (
                        <div className="mt-2 flex justify-between text-sm text-[var(--gold-soft)]">
                          <span>{upsellPlan.name} Membership</span>
                          <span>{formatCurrency(upsellPlan.price)}</span>
                        </div>
                      )}
                      <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-4 text-sm">
                        <div className="flex justify-between text-[var(--text-muted)]">
                          <span>Subtotal</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {discountValue > 0 && (
                          <div className="flex justify-between text-[var(--success)]">
                            <span>Discount</span>
                            <span>-{formatCurrency(discountValue)}</span>
                          </div>
                        )}
                        {posTip > 0 && (
                          <div className="flex justify-between text-[var(--text-muted)]">
                            <span>Tip</span>
                            <span>+{formatCurrency(posTip)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-display text-xl font-semibold">
                          <span>Total Due</span>
                          <span className="text-[var(--gold-soft)]">
                            {formatCurrency(total)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <div>
                      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)]">
                        <HandCoins className="h-4 w-4 text-[var(--gold)]" />
                        Add a tip for the barber
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TIP_PCTS.map((pct) => {
                          const amount =
                            pct === 0
                              ? 0
                              : Math.round(goodsTotal * pct) / 100;
                          const active =
                            pct === 0 ? posTip === 0 : posTip === amount;
                          return (
                            <button
                              key={pct}
                              onClick={() => setPosTip(amount)}
                              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                                active
                                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/10 text-[var(--gold-soft)]"
                                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-dim)]"
                              }`}
                            >
                              {pct === 0 ? "No tip" : `${pct}%`}
                              {pct !== 0 && (
                                <span className="ml-1 text-xs text-[var(--text-faint)]">
                                  {formatCurrency(amount)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={posTip || ""}
                          onChange={(e) =>
                            setPosTip(Math.max(0, Number(e.target.value) || 0))
                          }
                          placeholder="Custom RM"
                          className="w-28"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-medium text-[var(--text-muted)]">
                        Payment Method
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {METHODS.map((m) => {
                          const Icon = m.icon;
                          const selected = method === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => setMethod(m.id)}
                              className={`card-surface flex flex-col items-center gap-2 p-5 transition ${
                                selected
                                  ? "border-[var(--gold)]/50 ring-2 ring-[var(--gold)]/30"
                                  : "hover:border-[var(--gold-dim)]/40"
                              }`}
                            >
                              <Icon
                                className={`h-8 w-8 ${selected ? "text-[var(--gold)]" : "text-[var(--text-muted)]"}`}
                              />
                              <span className="font-medium">{m.label}</span>
                              <span className="text-center text-xs text-[var(--text-faint)]">
                                {m.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="xl"
                      onClick={handlePay}
                      disabled={!method || processing}
                    >
                      {processing
                        ? "Processing…"
                        : `Complete Payment · ${formatCurrency(total)}`}
                    </Button>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success)]/15"
                  >
                    <CheckCircle2 className="h-10 w-10 text-[var(--success)]" />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 font-display text-2xl font-bold"
                  >
                    Payment Successful
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-1 text-[var(--text-muted)]"
                  >
                    Transaction completed
                  </motion.p>
                </div>

                {receipt && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <Card className="overflow-hidden p-0">
                      <div className="border-b border-[var(--border)] bg-[var(--bg-muted)] px-5 py-4 text-center">
                        <p className="font-display text-lg font-bold">
                          Fade House KL
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          88 Jalan Bukit Bintang · +60 3-2141 8890
                        </p>
                      </div>
                      <div className="space-y-4 p-5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--text-muted)]">
                            Receipt
                          </span>
                          <Badge variant="gold">{receipt.receiptNo}</Badge>
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">
                          <p>{receipt.customerName}</p>
                          <p>Barber: {receipt.staffName}</p>
                          <p>{formatDateTime(receipt.createdAt)}</p>
                        </div>
                        <div className="space-y-2 border-y border-dashed border-[var(--border)] py-4">
                          {receipt.items.map((item) => (
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
                            <span>{formatCurrency(receipt.subtotal)}</span>
                          </div>
                          {receipt.discount > 0 && (
                            <div className="flex justify-between text-[var(--success)]">
                              <span>
                                Discount
                                {receipt.discountReason &&
                                  ` · ${receipt.discountReason}`}
                              </span>
                              <span>-{formatCurrency(receipt.discount)}</span>
                            </div>
                          )}
                          {receipt.tip > 0 && (
                            <div className="flex justify-between">
                              <span>Tip</span>
                              <span>+{formatCurrency(receipt.tip)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-display text-lg font-semibold">
                            <span>Total</span>
                            <span className="text-[var(--gold-soft)]">
                              {formatCurrency(receipt.total)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[var(--text-faint)]">
                            <span className="capitalize">
                              {receipt.paymentMethod}
                            </span>
                            <span>
                              Barber gets:{" "}
                              {formatCurrency(receipt.commission + receipt.tip)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4" />
                    Print Receipt
                  </Button>
                  <Button className="flex-1" size="lg" onClick={handleNewSale}>
                    <ShoppingCart className="h-4 w-4" />
                    New Sale
                  </Button>
                </div>

                <p className="text-center text-sm">
                  <Link
                    href="/cashier/sales"
                    className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--gold-soft)] hover:underline"
                  >
                    View past receipts
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {paid && receipt && (
            <p className="text-center text-xs text-[var(--text-faint)]">
              Thank you for visiting Fade House
            </p>
          )}
        </div>
      </PageTransition>
    </>
  );
}
