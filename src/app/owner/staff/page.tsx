"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Armchair,
  KeyRound,
  Mail,
  Plus,
  Search,
  Star,
  Target,
  MoreVertical,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/app-shell";
import { PageTransition } from "@/components/layout/page-transition";
import { StaffCard } from "@/components/domain/staff-card";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/lib/store/app-store";
import type { StaffMember, StaffStatus } from "@/lib/types";
import { formatCurrency, initials } from "@/lib/utils";

const STATUSES: StaffStatus[] = ["available", "busy", "break", "off-duty"];

type AddStaffForm = {
  name: string;
  phone: string;
  email: string;
  role: StaffMember["role"];
  specialty: string;
  branchId: string;
  monthlyTarget: string;
  chairId: string;
  password: string;
  confirmPassword: string;
  mustChangePassword: boolean;
};

const emptyForm = (): AddStaffForm => ({
  name: "",
  phone: "",
  email: "",
  role: "barber",
  specialty: "",
  branchId: "",
  monthlyTarget: "10000",
  chairId: "",
  password: "",
  confirmPassword: "",
  mustChangePassword: true,
});

export default function OwnerStaffPage() {
  const staff = useAppStore((s) => s.staff);
  const chairs = useAppStore((s) => s.chairs);
  const branches = useAppStore((s) => s.branches);
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const updateStaffStatus = useAppStore((s) => s.updateStaffStatus);
  const addStaff = useAppStore((s) => s.addStaff);
  const updateStaff = useAppStore((s) => s.updateStaff);
  const setStaffPassword = useAppStore((s) => s.setStaffPassword);
  const assignChair = useAppStore((s) => s.assignChair);
  const queue = useAppStore((s) => s.queue);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddStaffForm>(emptyForm);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const selected = useMemo(
    () => (selectedId ? staff.find((s) => s.id === selectedId) ?? null : null),
    [selectedId, staff],
  );

  const filtered = useMemo(() => {
    return staff.filter((s) => {
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.specialty.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || s.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [staff, search, roleFilter]);

  const filteredBarbers = useMemo(
    () => filtered.filter((s) => s.role === "barber"),
    [filtered],
  );
  const filteredManagement = useMemo(
    () => filtered.filter((s) => s.role !== "barber"),
    [filtered],
  );

  const barbers = useMemo(
    () => staff.filter((s) => s.role === "barber"),
    [staff],
  );
  const totalTodaySales = barbers.reduce((sum, s) => sum + s.todaySales, 0);

  function openAddModal() {
    setForm({
      ...emptyForm(),
      branchId: branches[0]?.id ?? "",
    });
    setAddOpen(true);
  }

  function openDetail(member: StaffMember) {
    setSelectedId(member.id);
    setResetPassword("");
    setResetConfirm("");
  }

  function closeDetail() {
    setSelectedId(null);
    setResetPassword("");
    setResetConfirm("");
  }

  function handleStatusChange(staffId: string, status: StaffStatus) {
    updateStaffStatus(staffId, status);
    toast.success("Status updated", {
      description: `${staff.find((s) => s.id === staffId)?.name} → ${status}`,
    });
  }

  function handleChairAssign(staffId: string, chairId: string) {
    const member = staff.find((s) => s.id === staffId);
    if (chairId) {
      assignChair(chairId, staffId);
    } else if (member?.chairId) {
      assignChair(member.chairId, null);
    }
    const chair = chairs.find((c) => c.id === chairId);
    toast.success("Chair assigned", {
      description: `${member?.name} → ${chair?.label ?? "None"}`,
    });
  }

  function handleTransferBranch(newBranchId: string) {
    if (!selected || newBranchId === selected.branchId) return;
    if (selected.chairId) {
      assignChair(selected.chairId, null);
    }
    updateStaff(selected.id, { branchId: newBranchId, chairId: null });
    const branchName = branches.find((b) => b.id === newBranchId)?.name;
    toast.success("Staff transferred", {
      description: `${selected.name} → ${branchName ?? "branch"}`,
    });
  }

  function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.branchId) {
      toast.error("Name and branch are required");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required for login");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const tempPassword = form.password;
    const loginEmail = form.email.trim();

    const member = addStaff({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: loginEmail,
      password: tempPassword,
      mustChangePassword: form.mustChangePassword,
      active: true,
      role: form.role,
      specialty: form.specialty.trim(),
      branchId: form.branchId,
      monthlyTarget: Number(form.monthlyTarget) || 10000,
      chairId: form.chairId || null,
      status: "off-duty",
    });

    if (form.chairId) {
      assignChair(form.chairId, member.id);
    }

    toast.success("Staff added", {
      description: `Login: ${loginEmail} / temp password shown once`,
    });
    setAddOpen(false);
    setForm(emptyForm());
  }

  function handleToggleActive() {
    if (!selected) return;
    const next = !(selected.active ?? true);
    updateStaff(selected.id, { active: next });
    toast.success(next ? "Account enabled" : "Account disabled", {
      description: next
        ? `${selected.name} can sign in again`
        : `${selected.name} cannot sign in`,
    });
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (resetPassword !== resetConfirm) {
      toast.error("Passwords do not match");
      return;
    }

    setStaffPassword(selected.id, resetPassword, { mustChangePassword: true });
    toast.success("Password reset", {
      description: `${selected.name} must change password on next login`,
    });
    setResetPassword("");
    setResetConfirm("");
  }

  return (
    <>
      <Topbar
        title="Staff Management"
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[var(--text-faint)] sm:inline">
              {barbers.length} barbers · {formatCurrency(totalTodaySales)} today
            </span>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </div>
        }
      />
      <PageTransition>
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Total Staff</p>
              <p className="font-display text-2xl font-semibold">{staff.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Available</p>
              <p className="font-display text-2xl font-semibold text-[var(--success)]">
                {barbers.filter((b) => staffStatuses[b.id] === "available").length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">In Service</p>
              <p className="font-display text-2xl font-semibold text-[var(--warning)]">
                {barbers.filter((b) => staffStatuses[b.id] === "busy").length}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--text-faint)]">Team Sales Today</p>
              <p className="font-display text-2xl font-semibold text-[var(--gold-soft)]">
                {formatCurrency(totalTodaySales)}
              </p>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                className="pl-10"
                placeholder="Search staff…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm capitalize"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="cashier">Cashier</option>
              <option value="barber">Barber</option>
            </select>
          </div>

          {filtered.length === 0 && (
            <Card className="py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                No staff match your search.
              </p>
            </Card>
          )}

          {filteredBarbers.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Barbers
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBarbers.map((member, i) => {
                  const status = staffStatuses[member.id];
                  const currentCustomer = queue.find(
                    (q) =>
                      q.assignedStaffId === member.id &&
                      q.status === "in-service",
                  )?.customerName;
                  const chairId = member.chairId;
                  const branchChairs = chairs.filter(
                    (c) => c.branchId === member.branchId,
                  );
                  const chair = chairs.find((c) => c.id === chairId);
                  const targetPct =
                    member.monthlyTarget > 0
                      ? Math.min(
                          100,
                          (member.monthlySales / member.monthlyTarget) * 100,
                        )
                      : 0;

                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex h-full flex-col gap-2"
                    >
                      <StaffCard
                        staff={member}
                        status={status}
                        currentCustomer={currentCustomer}
                      />

                      <div className="mt-auto space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-[var(--text-muted)]">
                            <Target className="h-3.5 w-3.5" />
                            Monthly target
                          </span>
                          <span>{Math.round(targetPct)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <div
                            className="h-full rounded-full gold-gradient"
                            style={{ width: `${targetPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={status}
                            onChange={(e) =>
                              handleStatusChange(
                                member.id,
                                e.target.value as StaffStatus,
                              )
                            }
                            className="h-9 flex-1 text-xs"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={chairId ?? ""}
                            onChange={(e) =>
                              handleChairAssign(member.id, e.target.value)
                            }
                            className="h-9 flex-1 text-xs"
                          >
                            <option value="">No chair</option>
                            {branchChairs.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 shrink-0 p-0"
                            onClick={() => openDetail(member)}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                        {chair && (
                          <p className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
                            <Armchair className="h-3 w-3" />
                            Assigned to {chair.label}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {filteredManagement.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Management
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredManagement.map((member, i) => {
                  const status = staffStatuses[member.id];
                  const isActive = member.active ?? true;

                  return (
                    <motion.button
                      key={member.id}
                      type="button"
                      onClick={() => openDetail(member)}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="text-left"
                    >
                      <Card
                        className={`p-4 transition hover:border-[var(--gold-dim)]/40 ${
                          !isActive ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 font-display text-sm font-semibold text-[var(--gold-soft)]">
                            {initials(member.name)}
                          </div>
                          <div className="flex flex-1 items-start justify-between">
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-xs capitalize text-[var(--text-muted)]">
                                {member.role} · {member.specialty}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={status} />
                              {!isActive && (
                                <Badge variant="default">Disabled</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </PageTransition>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Staff"
        description="Create a new team member with login credentials"
      >
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div>
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-phone">Phone</Label>
              <Input
                id="staff-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+60 12-345 6789"
              />
            </div>
            <div>
              <Label htmlFor="staff-email">Email (login ID)</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@fadehouse.my"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                minLength={6}
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <div>
              <Label htmlFor="staff-confirm-password">Confirm password</Label>
              <Input
                id="staff-confirm-password"
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm((f) => ({ ...f, confirmPassword: e.target.value }))
                }
                minLength={6}
                required
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-3">
            <input
              type="checkbox"
              checked={form.mustChangePassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, mustChangePassword: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--gold)]"
            />
            <span className="text-sm">
              <span className="font-medium">Require password change on first login</span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                Staff must set their own password after signing in with this temp password
              </span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-role">Role</Label>
              <Select
                id="staff-role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    role: e.target.value as StaffMember["role"],
                  }))
                }
              >
                <option value="barber">Barber</option>
                <option value="cashier">Cashier</option>
                <option value="owner">Owner</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="staff-specialty">Specialty</Label>
              <Input
                id="staff-specialty"
                value={form.specialty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specialty: e.target.value }))
                }
                placeholder="e.g. Fades & beard"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-branch">Branch</Label>
              <Select
                id="staff-branch"
                value={form.branchId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, branchId: e.target.value, chairId: "" }))
                }
                required
              >
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="staff-target">Monthly Target (RM)</Label>
              <Input
                id="staff-target"
                type="number"
                min={0}
                value={form.monthlyTarget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthlyTarget: e.target.value }))
                }
              />
            </div>
          </div>
          {form.role === "barber" && form.branchId && (
            <div>
              <Label htmlFor="staff-chair">Chair (optional)</Label>
              <Select
                id="staff-chair"
                value={form.chairId}
                onChange={(e) => setForm((f) => ({ ...f, chairId: e.target.value }))}
              >
                <option value="">No chair</option>
                {chairs
                  .filter((c) => c.branchId === form.branchId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Staff</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && closeDetail()}
        title={selected?.name}
        description={selected?.specialty}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={staffStatuses[selected.id]} />
              <span className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
                <Star className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" />
                {selected.rating}
              </span>
              {(selected.active ?? true) ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="default">Disabled</Badge>
              )}
            </div>

            <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">
                <Mail className="h-3.5 w-3.5" />
                Login ID
              </div>
              <p className="mt-1 font-medium">{selected.email}</p>
              <p className="mt-1 text-xs text-[var(--text-faint)]">
                Staff sign in with this email at the team login page
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Today Sales</p>
                <p className="font-display text-lg font-semibold text-[var(--gold-soft)]">
                  {formatCurrency(selected.todaySales)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Today Commission</p>
                <p className="font-display text-lg font-semibold">
                  {formatCurrency(selected.todayCommission)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Monthly Sales</p>
                <p className="font-semibold">{formatCurrency(selected.monthlySales)}</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-muted)] p-3">
                <p className="text-xs text-[var(--text-faint)]">Customers Today</p>
                <p className="font-semibold">{selected.todayCustomers}</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-muted)]">{selected.phone}</p>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-4 py-3">
              <p className="text-sm font-medium">Branch</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Transfer this staff member to another branch. Their chair
                assignment is cleared.
              </p>
              <Select
                value={selected.branchId}
                onChange={(e) => handleTransferBranch(e.target.value)}
                className="mt-2"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Account access</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {(selected.active ?? true)
                    ? "Can sign in to BarberFlow"
                    : "Sign-in blocked until re-enabled"}
                </p>
              </div>
              <Button
                type="button"
                variant={(selected.active ?? true) ? "outline" : "default"}
                size="sm"
                onClick={handleToggleActive}
              >
                {(selected.active ?? true) ? (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Enable
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[var(--gold)]" />
                <p className="text-sm font-medium">Reset Password</p>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    minLength={6}
                    placeholder="Min. 6 characters"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="reset-confirm">Confirm password</Label>
                  <Input
                    id="reset-confirm"
                    type="password"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <Button type="submit" size="sm" className="w-full">
                  Reset & require change on login
                </Button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
