"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Scissors,
  Armchair,
  ListOrdered,
  CalendarDays,
  Crown,
  Clock,
  Bell,
  Save,
  Plus,
  Pencil,
  Trash2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { BranchQrPanel } from "@/components/domain/branch-qr";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import type { Branch, MembershipPlan, Service } from "@/lib/types";
import { formatCurrency, initials } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";

const TABS = [
  { id: "profile", label: "Business", icon: Building2 },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "services", label: "Services", icon: Scissors },
  { id: "chairs", label: "Chairs", icon: Armchair },
  { id: "qr", label: "Walk-in QR", icon: QrCode },
  { id: "queue", label: "Queue Rules", icon: ListOrdered },
  { id: "booking", label: "Booking", icon: CalendarDays },
  { id: "membership", label: "Membership", icon: Crown },
  { id: "hours", label: "Hours", icon: Clock },
  { id: "notifications", label: "Alerts", icon: Bell },
] as const;

type TabId = (typeof TABS)[number]["id"];

type BranchDraft = Pick<
  Branch,
  "name" | "address" | "city" | "phone" | "openHours" | "chairs" | "status"
>;

type ServiceDraft = Pick<
  Service,
  "name" | "category" | "durationMins" | "price" | "membershipPrice" | "imageUrl"
>;

const emptyBranchForm = {
  name: "",
  address: "",
  city: "",
  phone: "",
  openHours: "10:00 – 22:00",
  chairs: 3,
};

const emptyServiceForm = {
  name: "",
  category: "Haircut",
  durationMins: 30,
  price: 45,
  membershipPrice: 38,
  imageUrl: undefined as string | undefined,
};

type PlanForm = {
  name: string;
  tier: MembershipPlan["tier"];
  price: number;
  discountPercent: number;
  benefits: string;
  members: number;
};

const emptyPlanForm: PlanForm = {
  name: "",
  tier: "silver",
  price: 49,
  discountPercent: 10,
  benefits: "",
  members: 0,
};

export default function OwnerSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  const storeBranches = useAppStore((s) => s.branches);
  const storeChairs = useAppStore((s) => s.chairs);
  const storeServices = useAppStore((s) => s.services);
  const storeStaff = useAppStore((s) => s.staff);
  const addBranch = useAppStore((s) => s.addBranch);
  const updateBranch = useAppStore((s) => s.updateBranch);
  const addChair = useAppStore((s) => s.addChair);
  const assignChair = useAppStore((s) => s.assignChair);
  const addService = useAppStore((s) => s.addService);
  const updateService = useAppStore((s) => s.updateService);
  const membershipPlans = useAppStore((s) => s.membershipPlans);
  const addMembershipPlan = useAppStore((s) => s.addMembershipPlan);
  const updateMembershipPlan = useAppStore((s) => s.updateMembershipPlan);
  const deleteMembershipPlan = useAppStore((s) => s.deleteMembershipPlan);
  const businessProfile = useAppStore((s) => s.businessProfile);
  const updateBusinessProfile = useAppStore((s) => s.updateBusinessProfile);

  const [profile, setProfile] = useState({
    name: businessProfile.name,
    phone: businessProfile.phone,
    email: businessProfile.email,
    address: businessProfile.address,
    taxId: businessProfile.taxId,
    logoUrl: businessProfile.logoUrl,
  });

  const [branchDrafts, setBranchDrafts] = useState<Record<string, BranchDraft>>(
    {},
  );
  const [serviceDrafts, setServiceDrafts] = useState<
    Record<string, ServiceDraft>
  >({});

  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState(emptyBranchForm);

  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState(emptyServiceForm);

  const [addChairOpen, setAddChairOpen] = useState(false);
  const [chairBranchId, setChairBranchId] = useState(storeBranches[0]?.id ?? "");
  const [chairLabel, setChairLabel] = useState("");
  const [chairFilterBranchId, setChairFilterBranchId] = useState(
    storeBranches[0]?.id ?? "",
  );

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);

  const [queueRules, setQueueRules] = useState({
    gracePeriodMins: 10,
    maxWaitMins: 45,
    autoCall: true,
    smsNotify: true,
    priorityMembers: true,
  });

  const [bookingRules, setBookingRules] = useState({
    advanceDays: 14,
    cancelHours: 4,
    slotInterval: 30,
    requireDeposit: false,
    depositAmount: 20,
    allowWalkInOverlap: true,
  });

  const [hours, setHours] = useState({
    weekdayOpen: "10:00",
    weekdayClose: "22:00",
    weekendOpen: "10:00",
    weekendClose: "22:00",
    closedDays: "None",
  });

  const [notifications, setNotifications] = useState({
    lowStock: true,
    dailyReport: true,
    noShowAlert: true,
    commissionSummary: true,
    queueThreshold: 8,
    email: "rizal@fadehouse.my",
  });

  useEffect(() => {
    if (!chairBranchId && storeBranches[0]) {
      setChairBranchId(storeBranches[0].id);
    }
    if (!chairFilterBranchId && storeBranches[0]) {
      setChairFilterBranchId(storeBranches[0].id);
    }
  }, [storeBranches, chairBranchId, chairFilterBranchId]);

  function getBranchDraft(branch: Branch): BranchDraft {
    return (
      branchDrafts[branch.id] ?? {
        name: branch.name,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        openHours: branch.openHours,
        chairs: branch.chairs,
        status: branch.status,
      }
    );
  }

  function patchBranchDraft(id: string, patch: Partial<BranchDraft>) {
    setBranchDrafts((prev) => {
      const branch = storeBranches.find((b) => b.id === id);
      if (!branch) return prev;
      const base = prev[id] ?? getBranchDraft(branch);
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  function getServiceDraft(service: Service): ServiceDraft {
    return (
      serviceDrafts[service.id] ?? {
        name: service.name,
        category: service.category,
        durationMins: service.durationMins,
        price: service.price,
        membershipPrice: service.membershipPrice,
        imageUrl: service.imageUrl,
      }
    );
  }

  function patchServiceDraft(id: string, patch: Partial<ServiceDraft>) {
    setServiceDrafts((prev) => {
      const service = storeServices.find((s) => s.id === id);
      if (!service) return prev;
      const base = prev[id] ?? getServiceDraft(service);
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  const filteredChairs = useMemo(
    () =>
      chairFilterBranchId
        ? storeChairs.filter((c) => c.branchId === chairFilterBranchId)
        : storeChairs,
    [storeChairs, chairFilterBranchId],
  );

  const branchBarbers = useMemo(
    () =>
      storeStaff.filter(
        (s) => s.role === "barber" && s.branchId === chairFilterBranchId,
      ),
    [storeStaff, chairFilterBranchId],
  );

  function handleSave(section: string) {
    toast.success("Settings saved", {
      description: `${section} updated successfully`,
    });
  }

  function handleSaveProfile() {
    updateBusinessProfile({
      name: profile.name.trim() || "My Business",
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      taxId: profile.taxId,
      logoUrl: profile.logoUrl,
    });
    toast.success("Settings saved", {
      description: "Business profile updated successfully",
    });
  }

  function handleSaveBranches() {
    storeBranches.forEach((branch) => {
      const draft = branchDrafts[branch.id];
      if (draft) updateBranch(branch.id, draft);
    });
    setBranchDrafts({});
    toast.success("Branches saved");
  }

  function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranchForm.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    const branch = addBranch({
      name: newBranchForm.name.trim(),
      address: newBranchForm.address.trim(),
      city: newBranchForm.city.trim(),
      phone: newBranchForm.phone.trim(),
      openHours: newBranchForm.openHours,
      chairs: 0,
      status: "open",
    });
    for (let i = 0; i < newBranchForm.chairs; i++) {
      addChair({ branchId: branch.id });
    }
    toast.success("Branch added", { description: branch.name });
    setAddBranchOpen(false);
    setNewBranchForm(emptyBranchForm);
  }

  function handleSaveServices() {
    storeServices.forEach((service) => {
      const draft = serviceDrafts[service.id];
      if (draft) updateService(service.id, draft);
    });
    setServiceDrafts({});
    toast.success("Services saved");
  }

  function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceForm.name.trim()) {
      toast.error("Service name is required");
      return;
    }
    const created = addService({
      name: newServiceForm.name.trim(),
      category: newServiceForm.category.trim(),
      durationMins: newServiceForm.durationMins,
      price: newServiceForm.price,
      membershipPrice: newServiceForm.membershipPrice,
      imageUrl: newServiceForm.imageUrl,
      popular: false,
    });
    toast.success("Service added", { description: created.name });
    setAddServiceOpen(false);
    setNewServiceForm(emptyServiceForm);
  }

  function openAddPlan() {
    setEditingPlanId(null);
    setPlanForm(emptyPlanForm);
    setPlanModalOpen(true);
  }

  function openEditPlan(plan: MembershipPlan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      tier: plan.tier,
      price: plan.price,
      discountPercent: plan.discountPercent,
      benefits: plan.benefits.join("\n"),
      members: plan.members,
    });
    setPlanModalOpen(true);
  }

  function handleSubmitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    const payload = {
      name: planForm.name.trim(),
      tier: planForm.tier,
      price: Number(planForm.price) || 0,
      discountPercent: Number(planForm.discountPercent) || 0,
      benefits: planForm.benefits
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean),
      members: Number(planForm.members) || 0,
    };
    if (editingPlanId) {
      updateMembershipPlan(editingPlanId, payload);
      toast.success("Plan updated", { description: payload.name });
    } else {
      addMembershipPlan(payload);
      toast.success("Plan added", { description: payload.name });
    }
    setPlanModalOpen(false);
  }

  function handleDeletePlan(plan: MembershipPlan) {
    deleteMembershipPlan(plan.id);
    toast.success("Plan removed", { description: plan.name });
  }

  function handleAddChair(e: React.FormEvent) {
    e.preventDefault();
    if (!chairBranchId) {
      toast.error("Select a branch");
      return;
    }
    const chair = addChair({
      branchId: chairBranchId,
      label: chairLabel.trim() || undefined,
    });
    toast.success("Chair added", { description: chair.label });
    setAddChairOpen(false);
    setChairLabel("");
  }

  return (
    <>
      <Topbar title="Settings" />
      <PageTransition>
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            <nav className="flex shrink-0 gap-2 overflow-x-auto pb-2 lg:w-52 lg:flex-col lg:overflow-visible lg:pb-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      active
                        ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "profile" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Profile</CardTitle>
                      </CardHeader>
                      <div className="mb-6">
                        <ImageUpload
                          label="Company Logo"
                          hint="Shown in sidebar & menus · PNG/JPG/WebP · max ~700KB"
                          value={profile.logoUrl}
                          onChange={(logoUrl) =>
                            setProfile({ ...profile, logoUrl })
                          }
                          previewClassName="h-28 w-28"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Business Name</Label>
                          <Input
                            value={profile.name}
                            onChange={(e) =>
                              setProfile({ ...profile, name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Tax / SSM ID</Label>
                          <Input
                            value={profile.taxId}
                            onChange={(e) =>
                              setProfile({ ...profile, taxId: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input
                            value={profile.phone}
                            onChange={(e) =>
                              setProfile({ ...profile, phone: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={profile.email}
                            onChange={(e) =>
                              setProfile({ ...profile, email: e.target.value })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label>Address</Label>
                          <Textarea
                            value={profile.address}
                            onChange={(e) =>
                              setProfile({ ...profile, address: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <Button className="mt-6" onClick={handleSaveProfile}>
                        <Save className="h-4 w-4" />
                        Save Profile
                      </Button>
                    </Card>
                  )}

                  {activeTab === "branches" && (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setAddBranchOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add Branch
                        </Button>
                      </div>
                      {storeBranches.map((branch) => {
                        const draft = getBranchDraft(branch);
                        return (
                          <Card key={branch.id}>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={draft.name}
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      name: e.target.value,
                                    })
                                  }
                                  className="font-display font-semibold"
                                />
                                <StatusBadge status={draft.status} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                  value={draft.address}
                                  placeholder="Address"
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      address: e.target.value,
                                    })
                                  }
                                />
                                <Input
                                  value={draft.city}
                                  placeholder="City"
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      city: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <Input
                                  value={draft.phone}
                                  placeholder="Phone"
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      phone: e.target.value,
                                    })
                                  }
                                />
                                <Input
                                  value={draft.openHours}
                                  placeholder="Open hours"
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      openHours: e.target.value,
                                    })
                                  }
                                />
                                <Input
                                  type="number"
                                  value={draft.chairs}
                                  placeholder="Chairs"
                                  onChange={(e) =>
                                    patchBranchDraft(branch.id, {
                                      chairs: Number(e.target.value),
                                    })
                                  }
                                />
                              </div>
                              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3">
                                <BranchQrPanel branch={branch} compact />
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                      <Button onClick={handleSaveBranches}>
                        <Save className="h-4 w-4" />
                        Save Branches
                      </Button>
                    </div>
                  )}

                  {activeTab === "services" && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setAddServiceOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add Service
                        </Button>
                      </div>
                      {storeServices.map((svc) => {
                        const draft = getServiceDraft(svc);
                        return (
                          <Card key={svc.id} className="p-4">
                            <div className="mb-4">
                              <ImageUpload
                                label="Service image"
                                value={draft.imageUrl}
                                onChange={(imageUrl) =>
                                  patchServiceDraft(svc.id, { imageUrl })
                                }
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-5">
                              <Input
                                value={draft.name}
                                placeholder="Name"
                                onChange={(e) =>
                                  patchServiceDraft(svc.id, {
                                    name: e.target.value,
                                  })
                                }
                              />
                              <Input
                                value={draft.category}
                                placeholder="Category"
                                onChange={(e) =>
                                  patchServiceDraft(svc.id, {
                                    category: e.target.value,
                                  })
                                }
                              />
                              <Input
                                type="number"
                                value={draft.price}
                                placeholder="Price"
                                onChange={(e) =>
                                  patchServiceDraft(svc.id, {
                                    price: Number(e.target.value),
                                  })
                                }
                              />
                              <Input
                                type="number"
                                value={draft.membershipPrice}
                                placeholder="Member price"
                                onChange={(e) =>
                                  patchServiceDraft(svc.id, {
                                    membershipPrice: Number(e.target.value),
                                  })
                                }
                              />
                              <Input
                                type="number"
                                value={draft.durationMins}
                                placeholder="Duration (min)"
                                onChange={(e) =>
                                  patchServiceDraft(svc.id, {
                                    durationMins: Number(e.target.value),
                                  })
                                }
                              />
                            </div>
                            {svc.popular && (
                              <Badge variant="gold" className="mt-2">
                                Popular
                              </Badge>
                            )}
                          </Card>
                        );
                      })}
                      <Button onClick={handleSaveServices}>
                        <Save className="h-4 w-4" />
                        Save Services
                      </Button>
                    </div>
                  )}

                  {activeTab === "chairs" && (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CardTitle>Chair Configuration</CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={chairFilterBranchId}
                              onChange={(e) =>
                                setChairFilterBranchId(e.target.value)
                              }
                              className="w-48"
                            >
                              {storeBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </Select>
                            <Button size="sm" onClick={() => setAddChairOpen(true)}>
                              <Plus className="h-4 w-4" />
                              Add Chair
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <div className="space-y-3">
                        {filteredChairs.length === 0 && (
                          <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                            No chairs for this branch yet.
                          </p>
                        )}
                        {filteredChairs.map((chair) => {
                          const assigned = storeStaff.find(
                            (s) => s.id === chair.staffId,
                          );
                          return (
                            <div
                              key={chair.id}
                              className="rounded-xl bg-[var(--bg-muted)] px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{chair.label}</p>
                                  <p className="text-xs text-[var(--text-faint)]">
                                    Station #{chair.number}
                                  </p>
                                </div>
                                {assigned ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gold)]/15 text-xs font-semibold text-[var(--gold-soft)]">
                                      {initials(assigned.name)}
                                    </div>
                                    <span className="text-sm">{assigned.name}</span>
                                  </div>
                                ) : (
                                  <Badge variant="default">Unassigned</Badge>
                                )}
                              </div>
                              <div className="mt-3">
                                <Label className="text-xs">Assign staff</Label>
                                <Select
                                  value={chair.staffId ?? ""}
                                  onChange={(e) =>
                                    assignChair(
                                      chair.id,
                                      e.target.value || null,
                                    )
                                  }
                                >
                                  <option value="">Unassigned</option>
                                  {branchBarbers.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name} · {b.specialty}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {activeTab === "qr" && (
                    <div className="space-y-4">
                      <Card className="border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
                        <p className="text-sm text-[var(--text-muted)]">
                          Customers scan a branch QR code to open{" "}
                          <span className="font-medium text-[var(--gold-soft)]">
                            /join/[branchId]
                          </span>{" "}
                          and submit the walk-in queue form. Cashiers can also
                          register walk-ins manually from Queue → Walk-in.
                        </p>
                      </Card>
                      {storeBranches.map((branch) => (
                        <BranchQrPanel key={branch.id} branch={branch} />
                      ))}
                    </div>
                  )}

                  {activeTab === "queue" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Queue Rules</CardTitle>
                      </CardHeader>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Grace Period (minutes)</Label>
                          <Input
                            type="number"
                            value={queueRules.gracePeriodMins}
                            onChange={(e) =>
                              setQueueRules({
                                ...queueRules,
                                gracePeriodMins: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Max Wait Alert (minutes)</Label>
                          <Input
                            type="number"
                            value={queueRules.maxWaitMins}
                            onChange={(e) =>
                              setQueueRules({
                                ...queueRules,
                                maxWaitMins: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {(
                          [
                            ["autoCall", "Auto-call next ticket"],
                            ["smsNotify", "SMS wait-time updates"],
                            ["priorityMembers", "Priority queue for members"],
                          ] as const
                        ).map(([key, label]) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center justify-between rounded-xl bg-[var(--bg-muted)] px-4 py-3"
                          >
                            <span className="text-sm">{label}</span>
                            <input
                              type="checkbox"
                              checked={queueRules[key]}
                              onChange={(e) =>
                                setQueueRules({
                                  ...queueRules,
                                  [key]: e.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[var(--gold)]"
                            />
                          </label>
                        ))}
                      </div>
                      <Button
                        className="mt-6"
                        onClick={() => handleSave("Queue rules")}
                      >
                        <Save className="h-4 w-4" />
                        Save Queue Rules
                      </Button>
                    </Card>
                  )}

                  {activeTab === "booking" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Booking Rules</CardTitle>
                      </CardHeader>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Advance Booking (days)</Label>
                          <Input
                            type="number"
                            value={bookingRules.advanceDays}
                            onChange={(e) =>
                              setBookingRules({
                                ...bookingRules,
                                advanceDays: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Cancel Window (hours)</Label>
                          <Input
                            type="number"
                            value={bookingRules.cancelHours}
                            onChange={(e) =>
                              setBookingRules({
                                ...bookingRules,
                                cancelHours: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Slot Interval (minutes)</Label>
                          <Select
                            value={String(bookingRules.slotInterval)}
                            onChange={(e) =>
                              setBookingRules({
                                ...bookingRules,
                                slotInterval: Number(e.target.value),
                              })
                            }
                          >
                            <option value="15">15 min</option>
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Deposit (RM)</Label>
                          <Input
                            type="number"
                            value={bookingRules.depositAmount}
                            disabled={!bookingRules.requireDeposit}
                            onChange={(e) =>
                              setBookingRules({
                                ...bookingRules,
                                depositAmount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl bg-[var(--bg-muted)] px-4 py-3">
                        <span className="text-sm">Require deposit for bookings</span>
                        <input
                          type="checkbox"
                          checked={bookingRules.requireDeposit}
                          onChange={(e) =>
                            setBookingRules({
                              ...bookingRules,
                              requireDeposit: e.target.checked,
                            })
                          }
                          className="h-4 w-4 accent-[var(--gold)]"
                        />
                      </label>
                      <Button
                        className="mt-6"
                        onClick={() => handleSave("Booking rules")}
                      >
                        <Save className="h-4 w-4" />
                        Save Booking Rules
                      </Button>
                    </Card>
                  )}

                  {activeTab === "membership" && (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={openAddPlan}>
                          <Plus className="h-4 w-4" />
                          Add Plan
                        </Button>
                      </div>
                      {membershipPlans.length === 0 && (
                        <Card className="py-10 text-center text-sm text-[var(--text-muted)]">
                          No membership plans yet. Add one to offer member
                          pricing.
                        </Card>
                      )}
                      {membershipPlans.map((plan) => (
                        <Card key={plan.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-display text-lg font-semibold">
                                  {plan.name}
                                </p>
                                <StatusBadge status={plan.tier} />
                              </div>
                              <p className="mt-1 text-sm text-[var(--gold-soft)]">
                                {formatCurrency(plan.price)}/mo ·{" "}
                                {plan.discountPercent}% off
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                                {plan.benefits.map((b) => (
                                  <li key={b}>· {b}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <Badge variant="default">
                                {plan.members} members
                              </Badge>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEditPlan(plan)}
                                  aria-label={`Edit ${plan.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-[var(--danger)]"
                                  onClick={() => handleDeletePlan(plan)}
                                  aria-label={`Delete ${plan.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {activeTab === "hours" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Business Hours</CardTitle>
                      </CardHeader>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label>Weekday Open</Label>
                          <Input
                            type="time"
                            value={hours.weekdayOpen}
                            onChange={(e) =>
                              setHours({ ...hours, weekdayOpen: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Weekday Close</Label>
                          <Input
                            type="time"
                            value={hours.weekdayClose}
                            onChange={(e) =>
                              setHours({ ...hours, weekdayClose: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Weekend Open</Label>
                          <Input
                            type="time"
                            value={hours.weekendOpen}
                            onChange={(e) =>
                              setHours({ ...hours, weekendOpen: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Weekend Close</Label>
                          <Input
                            type="time"
                            value={hours.weekendClose}
                            onChange={(e) =>
                              setHours({ ...hours, weekendClose: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <Button
                        className="mt-6"
                        onClick={() => handleSave("Business hours")}
                      >
                        <Save className="h-4 w-4" />
                        Save Hours
                      </Button>
                    </Card>
                  )}

                  {activeTab === "notifications" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Notification Preferences</CardTitle>
                      </CardHeader>
                      <div className="mb-4">
                        <Label>Alert Email</Label>
                        <Input
                          type="email"
                          value={notifications.email}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Queue Alert Threshold</Label>
                        <Input
                          type="number"
                          value={notifications.queueThreshold}
                          onChange={(e) =>
                            setNotifications({
                              ...notifications,
                              queueThreshold: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="mt-4 space-y-3">
                        {(
                          [
                            ["lowStock", "Low stock alerts"],
                            ["dailyReport", "Daily sales report"],
                            ["noShowAlert", "No-show notifications"],
                            ["commissionSummary", "Weekly commission summary"],
                          ] as const
                        ).map(([key, label]) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center justify-between rounded-xl bg-[var(--bg-muted)] px-4 py-3"
                          >
                            <span className="text-sm">{label}</span>
                            <input
                              type="checkbox"
                              checked={notifications[key]}
                              onChange={(e) =>
                                setNotifications({
                                  ...notifications,
                                  [key]: e.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-[var(--gold)]"
                            />
                          </label>
                        ))}
                      </div>
                      <Button
                        className="mt-6"
                        onClick={() => handleSave("Notifications")}
                      >
                        <Save className="h-4 w-4" />
                        Save Notifications
                      </Button>
                    </Card>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </PageTransition>

      <Modal
        open={addBranchOpen}
        onOpenChange={setAddBranchOpen}
        title="Add Branch"
        description="Create a new location and optionally set up chairs."
      >
        <form onSubmit={handleAddBranch} className="space-y-4">
          <div>
            <Label>Branch Name</Label>
            <Input
              value={newBranchForm.name}
              onChange={(e) =>
                setNewBranchForm({ ...newBranchForm, name: e.target.value })
              }
              placeholder="Fade House Penang"
              required
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={newBranchForm.address}
              onChange={(e) =>
                setNewBranchForm({ ...newBranchForm, address: e.target.value })
              }
              placeholder="Street address"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>City</Label>
              <Input
                value={newBranchForm.city}
                onChange={(e) =>
                  setNewBranchForm({ ...newBranchForm, city: e.target.value })
                }
                placeholder="City"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={newBranchForm.phone}
                onChange={(e) =>
                  setNewBranchForm({ ...newBranchForm, phone: e.target.value })
                }
                placeholder="+60 3-0000 0000"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Open Hours</Label>
              <Input
                value={newBranchForm.openHours}
                onChange={(e) =>
                  setNewBranchForm({
                    ...newBranchForm,
                    openHours: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Chairs to Create</Label>
              <Input
                type="number"
                min={0}
                value={newBranchForm.chairs}
                onChange={(e) =>
                  setNewBranchForm({
                    ...newBranchForm,
                    chairs: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg">
            Create Branch
          </Button>
        </form>
      </Modal>

      <Modal
        open={addServiceOpen}
        onOpenChange={setAddServiceOpen}
        title="Add Service"
        description="Add a new service to your menu."
      >
        <form onSubmit={handleAddService} className="space-y-4">
          <ImageUpload
            label="Service image"
            value={newServiceForm.imageUrl}
            onChange={(imageUrl) =>
              setNewServiceForm({ ...newServiceForm, imageUrl })
            }
          />
          <div>
            <Label>Service Name</Label>
            <Input
              value={newServiceForm.name}
              onChange={(e) =>
                setNewServiceForm({ ...newServiceForm, name: e.target.value })
              }
              placeholder="Classic Cut"
              required
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              value={newServiceForm.category}
              onChange={(e) =>
                setNewServiceForm({
                  ...newServiceForm,
                  category: e.target.value,
                })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={newServiceForm.durationMins}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    durationMins: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Price (RM)</Label>
              <Input
                type="number"
                value={newServiceForm.price}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    price: Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Member Price (RM)</Label>
              <Input
                type="number"
                value={newServiceForm.membershipPrice}
                onChange={(e) =>
                  setNewServiceForm({
                    ...newServiceForm,
                    membershipPrice: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <Button type="submit" className="w-full" size="lg">
            Add Service
          </Button>
        </form>
      </Modal>

      <Modal
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
        title={editingPlanId ? "Edit Membership Plan" : "Add Membership Plan"}
        description="Plans set the member discount applied at checkout."
      >
        <form onSubmit={handleSubmitPlan} className="space-y-4">
          <div>
            <Label>Plan Name</Label>
            <Input
              value={planForm.name}
              onChange={(e) =>
                setPlanForm({ ...planForm, name: e.target.value })
              }
              placeholder="Gold"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Tier</Label>
              <Select
                value={planForm.tier}
                onChange={(e) =>
                  setPlanForm({
                    ...planForm,
                    tier: e.target.value as MembershipPlan["tier"],
                  })
                }
              >
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </Select>
            </div>
            <div>
              <Label>Price (RM/mo)</Label>
              <Input
                type="number"
                min={0}
                value={planForm.price}
                onChange={(e) =>
                  setPlanForm({ ...planForm, price: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Discount (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={planForm.discountPercent}
                onChange={(e) =>
                  setPlanForm({
                    ...planForm,
                    discountPercent: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label>Benefits (one per line)</Label>
            <Textarea
              rows={4}
              value={planForm.benefits}
              onChange={(e) =>
                setPlanForm({ ...planForm, benefits: e.target.value })
              }
              placeholder={"15% off services\nPriority queue"}
            />
          </div>
          <div>
            <Label>Members</Label>
            <Input
              type="number"
              min={0}
              value={planForm.members}
              onChange={(e) =>
                setPlanForm({ ...planForm, members: Number(e.target.value) })
              }
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            {editingPlanId ? "Save Changes" : "Add Plan"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={addChairOpen}
        onOpenChange={setAddChairOpen}
        title="Add Chair"
        description="Add a new station to a branch."
      >
        <form onSubmit={handleAddChair} className="space-y-4">
          <div>
            <Label>Branch</Label>
            <Select
              value={chairBranchId}
              onChange={(e) => setChairBranchId(e.target.value)}
            >
              {storeBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Label (optional)</Label>
            <Input
              value={chairLabel}
              onChange={(e) => setChairLabel(e.target.value)}
              placeholder="Chair 4"
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Add Chair
          </Button>
        </form>
      </Modal>
    </>
  );
}
