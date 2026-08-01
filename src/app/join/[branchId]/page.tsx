"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { QrCode, Scissors } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";

/** QR deep link → customer join queue (phone or email required on that page). */
export default function JoinBranchPage() {
  const params = useParams<{ branchId: string }>();
  const router = useRouter();
  const branches = useAppStore((s) => s.branches);
  const setBranchId = useAppStore((s) => s.setBranchId);
  const branch = branches.find((b) => b.id === params.branchId) ?? branches[0];

  useEffect(() => {
    if (!branch) return;
    setBranchId(branch.id);
    const t = setTimeout(() => {
      router.replace(`/customer/queue?branch=${branch.id}&source=qr`);
    }, 700);
    return () => clearTimeout(t);
  }, [branch, router, setBranchId]);

  return (
    <div className="app-bg flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient">
          <Scissors className="h-8 w-8 text-[#0c0b09]" />
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          BarberFlow
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold">
          {branch?.name ?? "Opening…"}
        </h1>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)]">
          <QrCode className="h-4 w-4 text-[var(--gold)]" />
          QR check-in · enter phone or email next
        </p>
        <div className="mx-auto mt-8 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div className="h-full w-full animate-pulse gold-gradient" />
        </div>
      </div>
    </div>
  );
}
