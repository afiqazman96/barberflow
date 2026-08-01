"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Scissors, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { usePlatformStore } from "@/lib/store/platform-store";
import { formatCurrency, cn } from "@/lib/utils";

/**
 * Public pricing for barber shop owners to subscribe.
 * Creates a tenant (trial by default) visible in Super Admin.
 */
export default function PricingPage() {
  const router = useRouter();
  const packages = usePlatformStore((s) => s.packages);
  const addTenant = usePlatformStore((s) => s.addTenant);

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    ownerEmail: "",
  });

  function startSubscribe(packageId: string) {
    setSelectedPkg(packageId);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPkg) return;
    if (!form.businessName.trim() || !form.ownerEmail.trim()) {
      toast.error("Business name and email required");
      return;
    }
    const tenant = addTenant({
      businessName: form.businessName,
      ownerName: form.ownerName || form.businessName,
      ownerEmail: form.ownerEmail,
      packageId: selectedPkg,
      billing,
      startAs: "trial",
    });
    toast.success("14-day trial started", {
      description: `${tenant.name} · ${tenant.plan} plan`,
    });
    setOpen(false);
    setForm({ businessName: "", ownerName: "", ownerEmail: "" });
    router.push(`/?subscribed=${tenant.id}`);
  }

  const pkg = packages.find((p) => p.id === selectedPkg);

  return (
    <div className="app-bg min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <Scissors className="h-4 w-4 text-[var(--gold)]" />
            BarberFlow
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Run your barber shop
            <br />
            <span className="gold-text">on one system</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[var(--text-muted)]">
            Queue, booking, POS &amp; commissions. Start a free trial — no card
            required for the prototype.
          </p>

          <div className="mt-6 inline-flex rounded-xl bg-[var(--bg-muted)] p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                billing === "monthly"
                  ? "bg-[var(--bg-card)] text-[var(--gold-soft)]"
                  : "text-[var(--text-faint)]",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                billing === "yearly"
                  ? "bg-[var(--bg-card)] text-[var(--gold-soft)]"
                  : "text-[var(--text-faint)]",
              )}
            >
              Yearly
              <span className="ml-1.5 text-[10px] text-[var(--success)]">
                save ~17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((p) => {
            const price =
              billing === "yearly"
                ? Math.round(p.yearlyPrice / 12)
                : p.price;
            return (
              <Card
                key={p.id}
                className={cn(
                  "relative flex flex-col p-6",
                  p.popular && "border-[var(--gold)]/40 ring-1 ring-[var(--gold)]/20",
                )}
              >
                {p.popular && (
                  <Badge
                    variant="gold"
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2"
                  >
                    <Sparkles className="h-3 w-3" /> Most popular
                  </Badge>
                )}
                <h2 className="font-display text-xl font-semibold">{p.name}</h2>
                <p className="mt-3 font-display text-3xl font-bold text-[var(--gold-soft)]">
                  {formatCurrency(price)}
                  <span className="text-sm font-normal text-[var(--text-faint)]">
                    /mo
                  </span>
                </p>
                {billing === "yearly" && (
                  <p className="text-xs text-[var(--text-faint)]">
                    Billed {formatCurrency(p.yearlyPrice)} / year
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {p.trialDays}-day free trial · up to {p.maxBranches} branch
                  {p.maxBranches > 1 ? "es" : ""} · {p.maxStaff} staff
                </p>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={p.popular ? "default" : "secondary"}
                  onClick={() => startSubscribe(p.id)}
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-[var(--text-faint)]">
          Already have an account?{" "}
          <Link href="/" className="text-[var(--gold-soft)] hover:underline">
            Team sign in
          </Link>
        </p>
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`Start ${pkg?.name ?? ""} trial`}
        description={`${pkg?.trialDays ?? 14} days free · upgrade anytime from Super Admin or billing`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Shop / business name</Label>
            <Input
              value={form.businessName}
              onChange={(e) =>
                setForm({ ...form, businessName: e.target.value })
              }
              placeholder="e.g. Fade House JB"
              required
            />
          </div>
          <div>
            <Label>Owner name</Label>
            <Input
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div>
            <Label>Owner email</Label>
            <Input
              type="email"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm({ ...form, ownerEmail: e.target.value })
              }
              placeholder="owner@shop.my"
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Create trial account
          </Button>
        </form>
      </Modal>
    </div>
  );
}
