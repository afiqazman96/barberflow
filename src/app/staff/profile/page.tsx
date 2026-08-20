"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Armchair,
  KeyRound,
  Mail,
  Phone,
  Star,
  Scissors,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useStaffPortal } from "@/hooks/use-staff-portal";
import { changePassword } from "@/lib/auth/actions";
import { formatCurrency, initials } from "@/lib/utils";

function ChangePasswordSection() {
  const searchParams = useSearchParams();
  const forceChange = searchParams.get("changePassword") === "1";
  const sectionRef = useRef<HTMLDivElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!forceChange) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = sectionRef.current?.querySelector("input");
    firstInput?.focus();
  }, [forceChange]);

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    // Only the match check stays on the client — it is about the two boxes
    // agreeing, not about the password being right. Everything else is the
    // server's call, since that is where the real credential lives.
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.ok) {
        toast.error("Could not update password", { description: result.error });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    });
  }

  return (
    <div
      ref={sectionRef}
      className={forceChange ? "rounded-2xl ring-2 ring-[var(--gold)]/40" : undefined}
    >
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--gold)]" />
          Change Password
        </CardTitle>
      </CardHeader>

      {forceChange && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2.5 text-sm text-[var(--text-muted)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
          Update temporary password — your owner set a one-time login. Choose a
          new password before continuing.
        </div>
      )}

      <form onSubmit={handleChangePassword} className="space-y-3 px-4 pb-4">
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Card>
    </div>
  );
}

function StaffProfileContent() {
  const { staff, status, chair } = useStaffPortal();

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl gold-gradient font-display text-2xl font-bold text-[#0c0b09] shadow-[0_8px_32px_rgba(201,162,39,0.3)]">
          {initials(staff.name)}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {staff.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{staff.specialty}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <StatusBadge status={status} />
          <span className="flex items-center gap-1 rounded-lg bg-[var(--gold)]/10 px-2 py-1 text-xs font-medium text-[var(--gold-soft)]">
            <Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />
            {staff.rating}
          </span>
        </div>
      </motion.header>

      <ChangePasswordSection />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-[var(--gold)]" />
            Station
          </CardTitle>
        </CardHeader>
        <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-muted)] p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gold)]/15">
            <Armchair className="h-6 w-6 text-[var(--gold-soft)]" />
          </div>
          <div>
            <p className="font-medium">{chair?.label ?? "Unassigned"}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {chair ? `Chair ${chair.number} · Fade House KL` : "Pick a chair when you start shift"}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[var(--gold)]" />
            Performance
          </CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Monthly Sales
            </p>
            <p className="mt-1 font-display text-lg font-bold text-[var(--gold-soft)]">
              {formatCurrency(staff.monthlySales)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Commission
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              {formatCurrency(staff.monthlyCommission)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Today
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              {staff.todayCustomers} clients
            </p>
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
              Target
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              {formatCurrency(staff.monthlyTarget)}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <a
            href={`mailto:${staff.email}`}
            className="flex items-center gap-3 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <Mail className="h-4 w-4 text-[var(--gold)]" />
            {staff.email}
          </a>
          <a
            href={`tel:${staff.phone}`}
            className="flex items-center gap-3 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
          >
            <Phone className="h-4 w-4 text-[var(--gold)]" />
            {staff.phone}
          </a>
        </div>
      </Card>

      <SignOutButton
        label="Sign Out"
        variant="outline"
        size="lg"
        className="w-full"
      />
    </div>
  );
}

export default function StaffProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-[var(--text-muted)]">Loading…</div>}>
      <StaffProfileContent />
    </Suspense>
  );
}
