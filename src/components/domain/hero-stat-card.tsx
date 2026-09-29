"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dark, headline-number card at the top of a mobile dashboard — one
 * number the person opens the screen to check, with a 7-bar trend strip
 * underneath so today reads in context instead of alone.
 *
 * Deliberately the only dark surface on the screen: it earns that contrast by
 * carrying the single most important figure, and nothing else should compete
 * with it, so use this once per screen at most.
 */
export function HeroStatCard({
  label,
  value,
  pill,
  bars,
  className,
}: {
  label: string;
  value: string;
  /** Small trailing badge, e.g. "10 transactions". */
  pill?: string;
  /** Oldest first; the last entry is treated as "today" and highlighted. */
  bars: { label: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-[var(--hero-bg)] p-5 text-[var(--hero-text)] shadow-[var(--shadow)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[var(--gold)]/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--hero-text-muted)]">
          {label}
        </p>
        {pill && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[var(--hero-text)]">
            <TrendingUp className="h-3 w-3 text-[var(--gold)]" />
            {pill}
          </span>
        )}
      </div>
      <p className="relative mt-2 font-display text-4xl font-bold tracking-tight">
        {value}
      </p>

      <div className="relative mt-6 flex h-14 items-end gap-1.5">
        {bars.map((b, i) => {
          const isLast = i === bars.length - 1;
          const h = Math.max(8, Math.round((b.value / max) * 100));
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-14 w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-md transition-all",
                    isLast ? "bg-[var(--hero-bar-active)]" : "bg-[var(--hero-bar)]",
                  )}
                  style={{ height: `${h}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative mt-1.5 flex justify-between text-[10px] text-[var(--hero-text-muted)]">
        <span>{bars[0]?.label}</span>
        <span className="font-medium text-[var(--hero-text)]">
          {bars[bars.length - 1]?.label}
        </span>
      </div>
    </motion.div>
  );
}
