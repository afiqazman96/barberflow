"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Package, Pencil, Plus, Users } from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePlatformStore } from "@/lib/store/platform-store";
import type { Package as Pkg } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type PackageForm = {
  name: string;
  price: number;
  yearlyPrice: number;
  maxBranches: number;
  maxStaff: number;
  trialDays: number;
  featuresText: string;
  popular?: boolean;
};

const emptyForm: PackageForm = {
  name: "",
  price: 99,
  yearlyPrice: 990,
  maxBranches: 1,
  maxStaff: 5,
  trialDays: 14,
  featuresText: "",
};

function formFromPkg(pkg: Pkg): PackageForm {
  return {
    name: pkg.name,
    price: pkg.price,
    yearlyPrice: pkg.yearlyPrice,
    maxBranches: pkg.maxBranches,
    maxStaff: pkg.maxStaff,
    trialDays: pkg.trialDays,
    featuresText: pkg.features.join("\n"),
    popular: pkg.popular,
  };
}

function formToPatch(form: PackageForm): Omit<Pkg, "id"> {
  return {
    name: form.name.trim(),
    price: form.price,
    yearlyPrice: form.yearlyPrice,
    billing: "monthly",
    maxBranches: form.maxBranches,
    maxStaff: form.maxStaff,
    trialDays: form.trialDays,
    features: form.featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean),
    popular: form.popular,
  };
}

export default function SuperAdminPackagesPage() {
  const packages = usePlatformStore((s) => s.packages);
  const tenants = usePlatformStore((s) => s.tenants);
  const addPackage = usePlatformStore((s) => s.addPackage);
  const updatePackage = usePlatformStore((s) => s.updatePackage);

  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageForm>(emptyForm);

  const subscriberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tenants) {
      counts[t.packageId] = (counts[t.packageId] ?? 0) + 1;
    }
    return counts;
  }, [tenants]);

  function openEdit(pkg: Pkg) {
    setEditingId(pkg.id);
    setForm(formFromPkg(pkg));
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setAddOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Package name is required");
      return;
    }
    const data = formToPatch(form);
    if (editingId) {
      updatePackage(editingId, data);
      toast.success("Package updated", { description: form.name });
      setEditingId(null);
    } else {
      addPackage(data);
      toast.success("Package created", { description: form.name });
      setAddOpen(false);
    }
    setForm(emptyForm);
  }

  const modalOpen = addOpen || !!editingId;

  return (
    <>
      <Topbar
        title="Packages"
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[var(--text-faint)] sm:block">
              {packages.length} plans
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Package
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((pkg, i) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card
                  className={`relative flex h-full flex-col ${pkg.popular ? "border-[var(--gold)]/40 ring-1 ring-[var(--gold)]/20" : ""}`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge variant="gold">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex w-full items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gold)]/10 text-[var(--gold)]">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle>{pkg.name}</CardTitle>
                          <p className="text-xs text-[var(--text-faint)]">
                            Up to {pkg.maxBranches} branch
                            {pkg.maxBranches !== 1 && "es"} · {pkg.maxStaff}{" "}
                            staff · {pkg.trialDays}-day trial
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(pkg)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <div className="mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--text-faint)]" />
                    <span className="text-sm text-[var(--text-muted)]">
                      {subscriberCounts[pkg.id] ?? 0} subscriber
                      {(subscriberCounts[pkg.id] ?? 0) !== 1 && "s"}
                    </span>
                  </div>

                  <div className="mb-4">
                    <span className="font-display text-3xl font-bold">
                      {formatCurrency(pkg.price)}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">/mo</span>
                    <span className="ml-2 text-xs text-[var(--text-faint)]">
                      or {formatCurrency(pkg.yearlyPrice)}/yr
                    </span>
                  </div>

                  <ul className="flex-1 space-y-2.5">
                    {pkg.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-[var(--text-muted)]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={pkg.popular ? "default" : "secondary"}
                    className="mt-6 w-full"
                    onClick={() => openEdit(pkg)}
                  >
                    Edit Package
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </PageTransition>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditingId(null);
            setForm(emptyForm);
          }
        }}
        title={editingId ? "Edit Package" : "Add Package"}
        description={
          editingId
            ? "Update pricing, limits, and marketing features"
            : "Create a new subscription tier"
        }
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <Label>Package Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Growth"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Monthly Price (MYR)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Yearly Price (MYR)</Label>
              <Input
                type="number"
                min={0}
                value={form.yearlyPrice}
                onChange={(e) =>
                  setForm({ ...form, yearlyPrice: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Max Branches</Label>
              <Input
                type="number"
                min={1}
                value={form.maxBranches}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxBranches: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div>
              <Label>Max Staff</Label>
              <Input
                type="number"
                min={1}
                value={form.maxStaff}
                onChange={(e) =>
                  setForm({ ...form, maxStaff: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <Label>Trial Days</Label>
              <Input
                type="number"
                min={0}
                value={form.trialDays}
                onChange={(e) =>
                  setForm({ ...form, trialDays: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div>
            <Label>Features (one per line)</Label>
            <textarea
              value={form.featuresText}
              onChange={(e) =>
                setForm({ ...form, featuresText: e.target.value })
              }
              rows={5}
              placeholder={"Queue & walk-in\nAppointments\nPOS & payments"}
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--gold)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30"
            />
          </div>
          <Button className="w-full" onClick={handleSave}>
            {editingId ? "Save Package" : "Create Package"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
