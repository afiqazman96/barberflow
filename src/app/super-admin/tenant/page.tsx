"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Search } from "lucide-react";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { usePlatformStore } from "@/lib/store/platform-store";
import type { Tenant } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type StatusFilter = "all" | Tenant["status"];

function planVariant(plan: string): "gold" | "info" | "default" {
  if (plan === "Enterprise") return "gold";
  if (plan === "Growth") return "info";
  return "default";
}

const emptyAddForm = {
  businessName: "",
  ownerName: "",
  ownerEmail: "",
  packageId: "",
  billing: "monthly" as "monthly" | "yearly",
  startAs: "trial" as "trial" | "active",
  branches: 1,
  staff: 1,
};

export default function SuperAdminTenantPage() {
  const tenants = usePlatformStore((s) => s.tenants);
  const packages = usePlatformStore((s) => s.packages);
  const addTenant = usePlatformStore((s) => s.addTenant);
  const updateTenant = usePlatformStore((s) => s.updateTenant);
  const changeTenantPlan = usePlatformStore((s) => s.changeTenantPlan);
  const convertTrialToActive = usePlatformStore((s) => s.convertTrialToActive);
  const suspendTenant = usePlatformStore((s) => s.suspendTenant);
  const activateTenant = usePlatformStore((s) => s.activateTenant);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    ownerEmail: string;
    branches: number;
    staff: number;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [planModal, setPlanModal] = useState<Tenant | null>(null);
  const [planForm, setPlanForm] = useState({
    packageId: "",
    billing: "monthly" as "monthly" | "yearly",
  });

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.ownerEmail.toLowerCase().includes(q) ||
        t.ownerName.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  function openTenant(tenant: Tenant) {
    setSelected(tenant);
    setEditForm({
      name: tenant.name,
      ownerEmail: tenant.ownerEmail,
      branches: tenant.branches,
      staff: tenant.staff,
    });
  }

  function saveTenant() {
    if (!selected || !editForm) return;
    updateTenant(selected.id, editForm);
    const updated = { ...selected, ...editForm };
    setSelected(updated);
    toast.success("Tenant updated", { description: editForm.name });
  }

  function handleAddTenant() {
    if (!addForm.businessName.trim() || !addForm.ownerEmail.trim()) {
      toast.error("Business name and owner email are required");
      return;
    }
    const pkgId = addForm.packageId || packages[0]?.id;
    if (!pkgId) return;
    const tenant = addTenant({ ...addForm, packageId: pkgId });
    toast.success("Tenant onboarded", {
      description: `${tenant.name} · ${tenant.status === "trial" ? "Trial" : "Active"}`,
    });
    setAddOpen(false);
    setAddForm(emptyAddForm);
  }

  function openChangePlan(tenant: Tenant) {
    setPlanModal(tenant);
    setPlanForm({ packageId: tenant.packageId, billing: tenant.billing });
  }

  function handleChangePlan() {
    if (!planModal) return;
    changeTenantPlan(planModal.id, planForm.packageId, planForm.billing);
    toast.success("Plan updated", { description: planModal.name });
    setPlanModal(null);
    if (selected?.id === planModal.id) {
      const fresh = usePlatformStore
        .getState()
        .tenants.find((t) => t.id === planModal.id);
      if (fresh) openTenant(fresh);
    }
  }

  function handleConvertTrial(tenant: Tenant) {
    convertTrialToActive(tenant.id);
    toast.success("Trial converted", { description: tenant.name });
    if (selected?.id === tenant.id) {
      const fresh = usePlatformStore
        .getState()
        .tenants.find((t) => t.id === tenant.id);
      if (fresh) openTenant(fresh);
    }
  }

  function handleSuspend(tenant: Tenant) {
    suspendTenant(tenant.id);
    toast.success("Tenant suspended", { description: tenant.name });
    if (selected?.id === tenant.id) {
      const fresh = usePlatformStore
        .getState()
        .tenants.find((t) => t.id === tenant.id);
      if (fresh) openTenant(fresh);
    }
  }

  function handleActivate(tenant: Tenant) {
    activateTenant(tenant.id);
    toast.success("Tenant activated", { description: tenant.name });
    if (selected?.id === tenant.id) {
      const fresh = usePlatformStore
        .getState()
        .tenants.find((t) => t.id === tenant.id);
      if (fresh) openTenant(fresh);
    }
  }

  return (
    <>
      <Topbar
        title="Tenants"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-faint)]">
              {filtered.length} of {tenants.length}
            </span>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <Card>
            <CardHeader>
              <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[var(--gold)]" />
                  All Tenants
                </CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                    <Input
                      placeholder="Search tenants..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 sm:w-56"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="sm:w-40"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspended</option>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-faint)]">
                    <th className="pb-3 pr-4 font-medium">Tenant</th>
                    <th className="pb-3 pr-4 font-medium">Owner</th>
                    <th className="pb-3 pr-4 font-medium">Package</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">MRR</th>
                    <th className="pb-3 pr-4 font-medium">Trial Ends</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tenant, i) => (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--bg-muted)]/30"
                    >
                      <td className="py-3.5 pr-4">
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {tenant.slug}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="text-sm">{tenant.ownerName}</p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {tenant.ownerEmail}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge variant={planVariant(tenant.plan)}>
                          {tenant.plan}
                        </Badge>
                      </td>
                      <td className="py-3.5 pr-4">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="py-3.5 pr-4 font-medium">
                        {tenant.mrr > 0 ? formatCurrency(tenant.mrr) : "—"}
                      </td>
                      <td className="py-3.5 pr-4 text-[var(--text-muted)]">
                        {tenant.trialEndsAt
                          ? formatDate(tenant.trialEndsAt)
                          : "—"}
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTenant(tenant)}
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openChangePlan(tenant)}
                          >
                            Plan
                          </Button>
                          {tenant.status === "trial" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleConvertTrial(tenant)}
                            >
                              Convert
                            </Button>
                          )}
                          {tenant.status === "suspended" ? (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleActivate(tenant)}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleSuspend(tenant)}
                            >
                              Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-[var(--text-muted)]"
                      >
                        No tenants match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageTransition>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Tenant"
        description="Onboard a shop owner subscription"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div>
            <Label>Business Name</Label>
            <Input
              value={addForm.businessName}
              onChange={(e) =>
                setAddForm({ ...addForm, businessName: e.target.value })
              }
              placeholder="Sharp Cuts KL"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Owner Name</Label>
              <Input
                value={addForm.ownerName}
                onChange={(e) =>
                  setAddForm({ ...addForm, ownerName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Owner Email</Label>
              <Input
                type="email"
                value={addForm.ownerEmail}
                onChange={(e) =>
                  setAddForm({ ...addForm, ownerEmail: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Package</Label>
              <Select
                value={addForm.packageId || packages[0]?.id || ""}
                onChange={(e) =>
                  setAddForm({ ...addForm, packageId: e.target.value })
                }
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.price)}/mo
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Billing</Label>
              <Select
                value={addForm.billing}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    billing: e.target.value as "monthly" | "yearly",
                  })
                }
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Start As</Label>
              <Select
                value={addForm.startAs}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    startAs: e.target.value as "trial" | "active",
                  })
                }
              >
                <option value="trial">Trial</option>
                <option value="active">Active (paid)</option>
              </Select>
            </div>
            <div>
              <Label>Branches</Label>
              <Input
                type="number"
                min={1}
                value={addForm.branches}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    branches: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div>
              <Label>Staff</Label>
              <Input
                type="number"
                min={1}
                value={addForm.staff}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    staff: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          <Button className="w-full" onClick={handleAddTenant}>
            Onboard Tenant
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setEditForm(null);
          }
        }}
        title={selected?.name}
        description={`Owner: ${selected?.ownerName} · Joined ${selected ? formatDate(selected.createdAt) : ""}`}
        className="max-w-xl"
      >
        {editForm && selected && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Business Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Owner Email</Label>
                <Input
                  type="email"
                  value={editForm.ownerEmail}
                  onChange={(e) =>
                    setEditForm({ ...editForm, ownerEmail: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Branches</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.branches}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      branches: Number(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label>Staff</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.staff}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      staff: Number(e.target.value) || 1,
                    })
                  }
                />
              </div>
            </div>

            <div className="rounded-xl bg-[var(--bg-muted)] px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                <Badge variant={planVariant(selected.plan)}>{selected.plan}</Badge>
                <Badge variant="default">{selected.billing}</Badge>
              </div>
              <div className="mt-2 grid gap-1 text-[var(--text-muted)]">
                <p>
                  MRR:{" "}
                  <span className="font-medium text-[var(--text)]">
                    {selected.mrr > 0
                      ? `${formatCurrency(selected.mrr)}/mo`
                      : "—"}
                  </span>
                </p>
                {selected.trialEndsAt && (
                  <p>
                    Trial ends:{" "}
                    <span className="font-medium text-[var(--text)]">
                      {formatDate(selected.trialEndsAt)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button className="flex-1" onClick={saveTenant}>
                Save Changes
              </Button>
              <Button
                variant="secondary"
                onClick={() => openChangePlan(selected)}
              >
                Change Plan
              </Button>
              {selected.status === "trial" && (
                <Button
                  variant="secondary"
                  onClick={() => handleConvertTrial(selected)}
                >
                  Convert Trial
                </Button>
              )}
              {selected.status === "suspended" ? (
                <Button
                  variant="success"
                  onClick={() => handleActivate(selected)}
                >
                  Activate
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => handleSuspend(selected)}
                >
                  Suspend
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!planModal}
        onOpenChange={(open) => !open && setPlanModal(null)}
        title="Change Plan"
        description={planModal ? `Update subscription for ${planModal.name}` : ""}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Label>Package</Label>
            <Select
              value={planForm.packageId}
              onChange={(e) =>
                setPlanForm({ ...planForm, packageId: e.target.value })
              }
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.price)}/mo
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Billing Cycle</Label>
            <Select
              value={planForm.billing}
              onChange={(e) =>
                setPlanForm({
                  ...planForm,
                  billing: e.target.value as "monthly" | "yearly",
                })
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
          <Button className="w-full" onClick={handleChangePlan}>
            Update Plan
          </Button>
        </div>
      </Modal>
    </>
  );
}
