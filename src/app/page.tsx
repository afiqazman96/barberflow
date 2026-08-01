"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Scissors, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import type { UserRole } from "@/lib/types";
import { toast } from "sonner";

const roleRoutes: Record<UserRole, string> = {
  owner: "/owner/dashboard",
  cashier: "/cashier/dashboard",
  staff: "/staff/dashboard",
  "super-admin": "/super-admin/dashboard",
  customer: "/customer/home",
};

function roleFromStaff(
  role: "owner" | "cashier" | "barber",
): UserRole {
  if (role === "barber") return "staff";
  return role;
}

function TeamLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setRole = useAppStore((s) => s.setRole);
  const authenticate = useAppStore((s) => s.authenticate);

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const result = authenticate(email, password);
    if (!result.ok) {
      toast.error("Sign in failed", { description: result.error });
      return;
    }

    const appRole = roleFromStaff(result.staff.role);
    setRole(appRole, result.staff.id);

    if (result.staff.mustChangePassword) {
      toast.message("Please change your password", {
        description: "Owner set a temporary password for your account",
      });
      if (appRole === "staff") {
        router.push("/staff/profile?changePassword=1");
        return;
      }
    }

    toast.success("Signed in", {
      description: `Welcome, ${result.staff.name}`,
    });
    router.push(roleRoutes[appRole]);
  }

  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gold-gradient shadow-[0_8px_32px_rgba(201,162,39,0.35)]">
            <Scissors className="h-7 w-7 text-[#0c0b09]" />
          </div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">
            BarberFlow
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Team sign in
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Staff, cashier &amp; owner — use the email your owner created
          </p>
        </div>

        <div className="card-surface p-5 md:p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fadehouse.my"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          New shop owner?{" "}
          <Link
            href="/pricing"
            className="text-[var(--gold-soft)] hover:underline"
          >
            View plans &amp; start trial
          </Link>
          {" · "}
          <Link
            href="/display"
            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--gold-soft)]"
          >
            <Tv className="h-3.5 w-3.5" /> Queue display
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="app-bg min-h-dvh" />}>
      <TeamLoginForm />
    </Suspense>
  );
}
