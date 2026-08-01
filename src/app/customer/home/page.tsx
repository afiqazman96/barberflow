"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Scissors,
  MapPin,
  Clock,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export default function CustomerHomePage() {
  const BRANCHES = useAppStore((s) => s.branches);
  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gold-gradient shadow-[0_8px_32px_rgba(201,162,39,0.3)]">
          <Scissors className="h-7 w-7 text-[#0c0b09]" />
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          BarberFlow
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          Find your <span className="gold-text">fade</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Walk in or book ahead — real-time queue at every shop
        </p>
      </motion.header>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-3 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-[var(--gold-soft)]" />
        <p className="text-xs text-[var(--text-muted)]">
          <span className="font-medium text-[var(--gold-soft)]">Fade House</span>{" "}
          — {BRANCHES.length} locations across Malaysia
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Nearby Shops
        </h2>
        <div className="space-y-3">
          {BRANCHES.map((branch, i) => (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i }}
            >
              <Link href={`/customer/shop/${branch.id}`}>
                <Card
                  className={cn(
                    "group p-4 transition hover:border-[var(--gold)]/40",
                    branch.status === "busy" && "border-[var(--warning)]/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-semibold">
                          {branch.name}
                        </h3>
                        <StatusBadge status={branch.status} />
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {branch.city}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-faint)] transition group-hover:text-[var(--gold)]" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-center">
                      <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                        <Users className="h-3 w-3" /> Queue
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold text-[var(--gold-soft)]">
                        {branch.queueCount}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-center">
                      <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                        <Clock className="h-3 w-3" /> Avg Wait
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold">
                        {branch.avgWaitMins}
                        <span className="text-xs font-normal text-[var(--text-muted)]">
                          m
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                        Chairs
                      </p>
                      <p className="mt-0.5 font-display text-lg font-bold">
                        {branch.chairs}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-[var(--text-faint)]">
                    {branch.openHours} · {branch.address}
                  </p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
