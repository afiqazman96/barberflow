"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { changePassword } from "@/lib/auth/actions";

/**
 * Blocks the whole portal until a temporary password is replaced. The owner
 * hands out a one-time login, so nobody should be able to keep working on it —
 * this renders in place of the page, not beside it.
 *
 * Display gate only: the password itself is checked and changed on the server.
 */
export function ForcePasswordChange() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (next === current) {
      toast.error("Choose a different password from the temporary one");
      return;
    }
    startTransition(async () => {
      const result = await changePassword(current, next);
      if (!result.ok) {
        toast.error("Could not update password", { description: result.error });
        return;
      }
      toast.success("Password updated");
      router.refresh();
    });
  }

  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="card-surface w-full max-w-sm space-y-4 p-6"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[var(--gold)]" />
          <h1 className="font-display text-lg font-semibold">
            Set a new password
          </h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Your owner gave you a one-time password. Choose your own before you
          continue.
        </p>
        <div>
          <Label htmlFor="fp-current">Temporary password</Label>
          <Input
            id="fp-current"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <Label htmlFor="fp-new">New password</Label>
          <Input
            id="fp-new"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div>
          <Label htmlFor="fp-confirm">Confirm new password</Label>
          <Input
            id="fp-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </form>
    </div>
  );
}
