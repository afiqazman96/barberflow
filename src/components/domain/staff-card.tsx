"use client";

import { Armchair } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import type { StaffMember, StaffStatus } from "@/lib/types";
import { formatCurrency, initials } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app-store";

export function StaffCard({
  staff,
  status,
  currentCustomer,
}: {
  staff: StaffMember;
  status?: StaffStatus;
  currentCustomer?: string;
}) {
  const chairs = useAppStore((s) => s.chairs);
  const branches = useAppStore((s) => s.branches);
  const s = status ?? staff.status;
  const chair = chairs.find((c) => c.id === staff.chairId);
  const branch = branches.find((b) => b.id === staff.branchId);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 font-display text-sm font-semibold text-[var(--gold-soft)]">
          {initials(staff.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate font-medium">{staff.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{staff.specialty}</p>
            </div>
            <StatusBadge status={s} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2">
              <p className="text-[var(--text-faint)]">Sales</p>
              <p className="font-semibold text-[var(--gold-soft)]">
                {formatCurrency(staff.todaySales)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2">
              <p className="text-[var(--text-faint)]">Commission</p>
              <p className="font-semibold">{formatCurrency(staff.todayCommission)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Armchair className="h-3.5 w-3.5" />
              {chair?.label ?? "No chair"}
              {branch && (
                <span className="text-[var(--text-faint)]">
                  · {branch.name}
                </span>
              )}
            </span>
            {currentCustomer && (
              <span className="truncate text-[var(--gold-soft)]">
                → {currentCustomer}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
