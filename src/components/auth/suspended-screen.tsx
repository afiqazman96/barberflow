"use client";

import { PauseCircle } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Shown in place of every shop portal while the tenant is suspended, so the
 * "loses access immediately" promise in Super Admin is actually kept.
 */
export function SuspendedScreen({ shopName }: { shopName: string }) {
  return (
    <div className="app-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card-surface w-full max-w-sm space-y-4 p-6 text-center">
        <PauseCircle className="mx-auto h-10 w-10 text-[var(--warning)]" />
        <h1 className="font-display text-lg font-semibold">Subscription paused</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {shopName}&apos;s BarberFlow subscription is suspended, so the shop
          can&apos;t be used right now. Please contact BarberFlow support to get
          it turned back on.
        </p>
        <SignOutButton variant="outline" size="default" className="w-full justify-center" />
      </div>
    </div>
  );
}
