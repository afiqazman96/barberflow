"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Non-interactive wizard progress: a filled pill-circle per step, connected
 * by a thin bar, with the current step's label underneath. Purely a
 * read-out of `current` — never clickable, so it can't be used to jump
 * ahead of validated steps. Used on the customer-facing queue and booking
 * wizards in place of a plain progress bar.
 */
export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div>
      <div className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
                  done || active
                    ? "bg-[var(--text)] text-[var(--bg)]"
                    : "bg-[var(--bg-muted)] text-[var(--text-faint)]",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1.5 h-0.5 flex-1 rounded-full transition",
                    done ? "bg-[var(--text)]" : "bg-[var(--bg-muted)]",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--text-faint)]">
        Step {current + 1} of {steps.length} · {steps[current]}
      </p>
    </div>
  );
}
