"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  delay?: number;
}) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Card className="relative overflow-hidden">
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[var(--gold)]/5" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">
              {label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {value}
            </p>
            {change && (
              <div
                className={cn(
                  "mt-2 flex items-center gap-1 text-xs font-medium",
                  trend === "up" && "text-[var(--success)]",
                  trend === "down" && "text-[var(--danger)]",
                  trend === "neutral" && "text-[var(--text-muted)]",
                )}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {change}
              </div>
            )}
          </div>
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gold)]/15 text-[var(--gold-soft)]">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
