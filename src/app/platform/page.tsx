"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Scissors, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import { toast } from "sonner";

const DEMO_EMAIL = "admin@barberflow.app";
const DEMO_PASSWORD = "demo1234";

/**
 * Hidden platform console — not linked from shop / customer UI.
 * Open directly: /platform
 */
export default function PlatformLoginPage() {
  const router = useRouter();
  const setRole = useAppStore((s) => s.setRole);
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (normalized !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      toast.error("Invalid credentials", {
        description: "Check your platform admin email and password",
      });
      return;
    }

    setLoading(true);
    setRole("super-admin", null);
    toast.success("Platform access", {
      description: "Welcome, Super Admin",
    });
    router.push("/super-admin/dashboard");
  }

  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--gold)]/30 bg-gradient-to-br from-[var(--gold)]/20 to-[var(--bg-card)] shadow-[0_8px_32px_rgba(201,162,39,0.15)]">
            <Shield className="h-8 w-8 text-[var(--gold)]" />
          </div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">
            BarberFlow Platform
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Super Admin
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            Internal console · not for shop users
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card-surface overflow-hidden p-5 md:p-7"
        >
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-2.5 text-xs text-[var(--text-muted)]">
            <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />
            Demo access only — credentials are validated
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Admin email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@barberflow.app"
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
                placeholder="Enter platform password"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              Enter platform
            </Button>
          </form>
        </motion.div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[var(--text-faint)]">
          <Scissors className="h-3.5 w-3.5" />
          Shop team login is at{" "}
          <button
            type="button"
            className="text-[var(--text-muted)] underline-offset-2 hover:text-[var(--gold-soft)] hover:underline"
            onClick={() => router.push("/")}
          >
            /
          </button>
        </p>
      </div>
    </div>
  );
}
