"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Minus,
  Plus,
  Trash2,
  Sparkles,
  ShoppingBag,
  User,
  Scissors,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore, calcCommission } from "@/lib/store/app-store";
import { CUSTOMERS } from "@/lib/mock/data";
import { formatCurrency } from "@/lib/utils";

type Tab = "services" | "products";

export default function CashierPosPage() {
  const router = useRouter();
  const queue = useAppStore((s) => s.queue);
  const staff = useAppStore((s) => s.staff);
  const branchId = useAppStore((s) => s.branchId);
  const PRODUCTS = useAppStore((s) => s.products);
  const SERVICES = useAppStore((s) => s.services);
  const commissionRules = useAppStore((s) => s.commissionRules);
  const membershipPlans = useAppStore((s) => s.membershipPlans);
  const posItems = useAppStore((s) => s.posItems);
  const posDiscount = useAppStore((s) => s.posDiscount);
  const posDiscountMode = useAppStore((s) => s.posDiscountMode);
  const posDiscountReason = useAppStore((s) => s.posDiscountReason);
  const posCustomerId = useAppStore((s) => s.posCustomerId);
  const posTicketId = useAppStore((s) => s.posTicketId);
  const posStaffId = useAppStore((s) => s.posStaffId);
  const posMembershipPlanId = useAppStore((s) => s.posMembershipPlanId);
  const addPosItem = useAppStore((s) => s.addPosItem);
  const updatePosQty = useAppStore((s) => s.updatePosQty);
  const removePosItem = useAppStore((s) => s.removePosItem);
  const setPosDiscount = useAppStore((s) => s.setPosDiscount);
  const setPosDiscountMode = useAppStore((s) => s.setPosDiscountMode);
  const setPosDiscountReason = useAppStore((s) => s.setPosDiscountReason);
  const setPosStaffId = useAppStore((s) => s.setPosStaffId);
  const setPosMembershipPlan = useAppStore((s) => s.setPosMembershipPlan);
  const loadPosTicket = useAppStore((s) => s.loadPosTicket);
  const clearPos = useAppStore((s) => s.clearPos);

  const [tab, setTab] = useState<Tab>("services");
  const [catalogSearch, setCatalogSearch] = useState("");

  const awaitingPayment = queue.filter((q) => q.status === "awaiting-payment");
  const barbers = staff.filter(
    (s) => s.role === "barber" && s.branchId === branchId,
  );

  // One customer waiting to pay is the common case — load them so the cashier
  // isn't retyping a service the barber already recorded.
  useEffect(() => {
    if (!posTicketId && posItems.length === 0 && awaitingPayment.length === 1) {
      loadPosTicket(awaitingPayment[0].id);
    }
  }, [posTicketId, posItems.length, awaitingPayment, loadPosTicket]);

  const ticket = posTicketId
    ? queue.find((q) => q.id === posTicketId)
    : null;
  const crmCustomer = posCustomerId
    ? CUSTOMERS.find((c) => c.id === posCustomerId)
    : null;

  const customerName = ticket?.customerName ?? crmCustomer?.name ?? null;
  const upsellPlan = posMembershipPlanId
    ? membershipPlans.find((p) => p.id === posMembershipPlanId)
    : null;
  const membership = upsellPlan
    ? upsellPlan.tier
    : (crmCustomer?.membership ?? "none");

  const cartSubtotal = posItems.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const subtotal = cartSubtotal + (upsellPlan?.price ?? 0);
  const discountValue =
    posDiscountMode === "percent"
      ? Math.round(((subtotal * posDiscount) / 100) * 100) / 100
      : posDiscount;
  const total = Math.max(0, subtotal - discountValue);

  const barberCommission =
    posStaffId && posItems.length > 0
      ? calcCommission(
          Math.max(0, cartSubtotal - discountValue),
          posStaffId,
          posItems,
          commissionRules,
        )
      : 0;
  const barberName = barbers.find((b) => b.id === posStaffId)?.name;

  // Show the member-price saving only when the customer isn't already one.
  const alreadyMember =
    (crmCustomer?.membership ?? "none") !== "none";
  const cheapestPlan = [...membershipPlans].sort((a, b) => a.price - b.price)[0];
  const memberSaving =
    cheapestPlan && !alreadyMember
      ? posItems
          .filter((i) => i.type === "service")
          .reduce((sum, i) => {
            const svc = SERVICES.find((v) => v.id === i.id);
            return svc ? sum + (svc.price - svc.membershipPrice) * i.quantity : sum;
          }, 0)
      : 0;

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
    const price = getPrice(item);
    addPosItem({
      id: item.id,
      type: item.type,
      name: item.name,
      quantity: 1,
      unitPrice: price,
    });
    toast.success("Added to cart", { description: item.name });
  }

  function handleSelectTicket(ticketId: string, ticketName: string) {
    loadPosTicket(ticketId);
    toast.success("Loaded for checkout", { description: ticketName });
  }

  function handlePay() {
    if (posItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!posStaffId) {
      toast.error("Pick the barber who served this customer");
      return;
    }
    router.push("/cashier/payment");
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

            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.map((item, i) => {
                const imageUrl =
                  "imageUrl" in item && typeof item.imageUrl === "string"
                    ? item.imageUrl
                    : undefined;
                return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleAdd(item)}
                  className="card-surface flex items-center justify-between gap-3 p-4 text-left transition hover:border-[var(--gold)]/40 active:scale-[0.98]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-[var(--border)]"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/12 text-[var(--gold-soft)]">
                        {tab === "services" ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <ShoppingBag className="h-4 w-4" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium">{item.name}</p>
                        {"popular" in item && item.popular && (
                          <Badge variant="gold" className="shrink-0">
                            Popular
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-faint)]">
                        {item.category}
                        {"stock" in item && ` · ${item.stock} in stock`}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-[var(--gold-soft)]">
                      {formatCurrency(getPrice(item))}
                    </p>
                    {item.type === "service" &&
                      membership !== "none" &&
                      "membershipPrice" in item && (
                        <p className="text-[10px] line-through text-[var(--text-faint)]">
                          {formatCurrency(item.price)}
                        </p>
                      )}
                  </div>
                </motion.button>
                );
              })}
            </div>
          </div>

          <div className="w-full shrink-0 space-y-4 lg:w-96">
            {awaitingPayment.length > 0 && (
              <Card className="p-4">
                <CardHeader className="mb-3">
                  <CardTitle className="text-sm">Awaiting Payment</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {awaitingPayment.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTicket(t.id, t.customerName)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        posTicketId === t.id
                          ? "bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/30"
                          : "bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      <span className="font-display font-bold text-[var(--gold-soft)]">
                        {t.number}
                      </span>
                      <span className="truncate">{t.customerName}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="sticky top-20 p-4">
              <CardHeader className="mb-3">
                <CardTitle>Cart</CardTitle>
              </CardHeader>

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

              <div className="mb-3">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Scissors className="h-3.5 w-3.5 text-[var(--gold)]" />
                  Barber (earns commission)
                </Label>
                <Select
                  value={posStaffId ?? ""}
                  onChange={(e) => setPosStaffId(e.target.value || null)}
                >
                  <option value="">Select barber…</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                {barberCommission > 0 && barberName && (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    {barberName} earns{" "}
                    <span className="font-semibold text-[var(--gold-soft)]">
                      ≈ {formatCurrency(barberCommission)}
                    </span>{" "}
                    commission
                  </p>
                )}
              </div>

              {upsellPlan ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--gold)]/25 bg-[var(--gold)]/8 px-3 py-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                  <span className="text-[var(--gold-soft)]">
                    {upsellPlan.name} membership added ·{" "}
                    {formatCurrency(upsellPlan.price)}
                  </span>
                  <button
                    onClick={() => setPosMembershipPlan(null)}
                    className="ml-auto text-[var(--text-faint)] underline underline-offset-2 hover:text-[var(--text)]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                memberSaving > 0 &&
                cheapestPlan && (
                  <button
                    onClick={() => setPosMembershipPlan(cheapestPlan.id)}
                    className="mb-3 flex w-full items-start gap-2 rounded-lg border border-dashed border-[var(--gold)]/40 bg-[var(--gold)]/5 px-3 py-2 text-left text-xs transition hover:bg-[var(--gold)]/10"
                  >
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
                    <span>
                      <span className="font-medium text-[var(--gold-soft)]">
                        Add {cheapestPlan.name} membership
                      </span>{" "}
                      ({formatCurrency(cheapestPlan.price)}/mo) — this visit saves{" "}
                      {formatCurrency(memberSaving)}
                    </span>
                  </button>
                )
              )}

              {membership !== "none" && !upsellPlan && (
                <p className="mb-3 rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-3 py-2 text-xs text-[var(--gold-soft)]">
                  Membership pricing applied for {membership} member
                </p>
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
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {formatCurrency(item.unitPrice)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updatePosQty(item.id, item.quantity - 1)
                          }
                          className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updatePosQty(item.id, item.quantity + 1)
                          }
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
                  <div className="flex items-center justify-between">
                    <Label>Discount</Label>
                    <div className="flex gap-1 rounded-lg bg-[var(--bg-muted)] p-0.5 text-xs">
                      {(["amount", "percent"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPosDiscountMode(m)}
                          className={`rounded px-2 py-0.5 transition ${
                            posDiscountMode === m
                              ? "bg-[var(--bg-elevated)] font-medium text-[var(--text)]"
                              : "text-[var(--text-faint)]"
                          }`}
                        >
                          {m === "amount" ? "RM" : "%"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={posDiscountMode === "percent" ? 100 : undefined}
                    step={1}
                    value={posDiscount || ""}
                    onChange={(e) =>
                      setPosDiscount(Math.max(0, Number(e.target.value) || 0))
                    }
                    placeholder="0"
                  />
                  {posDiscount > 0 && (
                    <Select
                      value={posDiscountReason}
                      onChange={(e) => setPosDiscountReason(e.target.value)}
                      className="mt-2 text-xs"
                    >
                      <option value="">Reason for discount…</option>
                      <option value="Regular customer">Regular customer</option>
                      <option value="Birthday">Birthday</option>
                      <option value="Service issue">Service issue</option>
                      <option value="Staff / family">Staff / family</option>
                      <option value="Promotion">Promotion</option>
                    </Select>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-[var(--success)]">
                      <span>
                        Discount
                        {posDiscountMode === "percent" && ` (${posDiscount}%)`}
                      </span>
                      <span>-{formatCurrency(discountValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-display text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-[var(--gold-soft)]">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  <p className="pt-1 text-xs text-[var(--text-faint)]">
                    Add a tip at payment
                  </p>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePay}
                  disabled={posItems.length === 0 || !posStaffId}
                >
                  Pay {formatCurrency(total)}
                </Button>
                <Button asChild variant="ghost" className="w-full" size="sm">
                  <Link href="/cashier/queue">Back to Queue</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </PageTransition>
    </>
  );
}
