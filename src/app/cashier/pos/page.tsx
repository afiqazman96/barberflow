"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { CUSTOMERS } from "@/lib/mock/data";
import { formatCurrency } from "@/lib/utils";

type Tab = "services" | "products";

export default function CashierPosPage() {
  const router = useRouter();
  const queue = useAppStore((s) => s.queue);
  const PRODUCTS = useAppStore((s) => s.products);
  const SERVICES = useAppStore((s) => s.services);
  const posItems = useAppStore((s) => s.posItems);
  const posDiscount = useAppStore((s) => s.posDiscount);
  const posCustomerId = useAppStore((s) => s.posCustomerId);
  const addPosItem = useAppStore((s) => s.addPosItem);
  const updatePosQty = useAppStore((s) => s.updatePosQty);
  const removePosItem = useAppStore((s) => s.removePosItem);
  const setPosDiscount = useAppStore((s) => s.setPosDiscount);
  const setPosCustomerId = useAppStore((s) => s.setPosCustomerId);
  const clearPos = useAppStore((s) => s.clearPos);

  const [tab, setTab] = useState<Tab>("services");
  const [catalogSearch, setCatalogSearch] = useState("");

  const awaitingPayment = queue.filter((q) => q.status === "awaiting-payment");

  const customer = posCustomerId
    ? CUSTOMERS.find((c) => c.id === posCustomerId) ??
      queue.find((q) => q.customerId === posCustomerId)
    : null;

  const customerName =
    customer && "name" in customer
      ? customer.name
      : customer && "customerName" in customer
        ? customer.customerName
        : null;

  const membership =
    customer && "membership" in customer ? customer.membership : "none";

  const subtotal = posItems.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0,
  );
  const total = Math.max(0, subtotal - posDiscount);

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

  function handleSelectCustomer(customerId: string) {
    const ticket = queue.find((q) => q.customerId === customerId);
    if (!ticket) return;
    setPosCustomerId(customerId);
    if (posItems.length === 0) {
      ticket.serviceIds.forEach((sid) => {
        const svc = SERVICES.find((s) => s.id === sid);
        if (svc) {
          const cust = CUSTOMERS.find((c) => c.id === customerId);
          const price =
            cust && cust.membership !== "none"
              ? svc.membershipPrice
              : svc.price;
          addPosItem({
            id: svc.id,
            type: "service",
            name: svc.name,
            quantity: 1,
            unitPrice: price,
          });
        }
      });
    }
    toast.success("Customer selected", { description: ticket.customerName });
  }

  function handlePay() {
    if (posItems.length === 0) {
      toast.error("Cart is empty");
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
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{item.name}</p>
                        {"popular" in item && item.popular && (
                          <Badge variant="gold">Popular</Badge>
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
                      onClick={() => handleSelectCustomer(t.customerId)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                        posCustomerId === t.customerId
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

              {membership !== "none" && (
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
                  <Label>Discount (RM)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
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
                  onClick={handlePay}
                  disabled={posItems.length === 0}
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
