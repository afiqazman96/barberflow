"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scissors, Tv } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";
import { homeRouteFor } from "@/lib/auth/roles";
import { useAppStore } from "@/lib/store/app-store";

export function TeamLoginForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      // The password never touches the client store — `signIn` runs on the
      // server, hands Supabase the credentials, and comes back with a session
      // cookie already set on the response.
      const result = await signIn(email, password);

      if (!result.ok) {
        toast.error("Sign in failed", { description: result.error });
        return;
      }

      const user = result.data;
      setSession(user);

      if (user.mustChangePassword) {
        toast.message("Please change your password", {
          description: "Your owner set a temporary password for this account",
        });
        if (user.role === "staff") {
          router.replace("/staff/profile?changePassword=1");
          return;
        }
      }

      toast.success("Signed in", { description: `Welcome, ${user.name}` });
      // replace(), not push(): the login screen should not sit in history
      // behind the portal, where Back would land on a dead form.
      router.replace(homeRouteFor(user.role));
    });
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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={pending}
            >
              {pending ? "Signing in…" : "Sign in"}
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
