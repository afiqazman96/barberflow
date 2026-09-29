"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CHIP_STYLES = {
  mint: "bg-[var(--chip-mint-bg)] text-[var(--chip-mint-fg)]",
  amber: "bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]",
  sky: "bg-[var(--chip-sky-bg)] text-[var(--chip-sky-fg)]",
  coral: "bg-[var(--chip-coral-bg)] text-[var(--chip-coral-fg)]",
} as const;

/**
 * One glanceable number: a colour-coded icon chip, a big value and a short
 * caption underneath. Used in 2×2 / 3-up grids on dashboards and summary
 * screens — the chip colour is the only thing that tells tiles apart, so give
 * each tile in a row a different one.
 */
export function StatTile({
  icon: Icon,
  chip,
  value,
  unit,
  label,
  delay = 0,
}: {
  icon: LucideIcon;
  chip: keyof typeof CHIP_STYLES;
  value: string;
  /** Short suffix rendered smaller next to the value, e.g. "min". */
  unit?: string;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card-surface flex flex-col gap-3 p-4"
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          CHIP_STYLES[chip],
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="font-display text-2xl font-bold leading-none tracking-tight">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">
              {unit}
            </span>
          )}
        </p>
        <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]">{label}</p>
      </div>
    </motion.div>
  );
}
