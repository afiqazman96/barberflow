"use client";

import { cn } from "@/lib/utils";

export interface PillTab {
  value: string;
  label: string;
  /** Rendered as a dimmed suffix, e.g. a count. */
  count?: number;
}

/**
 * Horizontal-scrolling segmented control: one solid pill for the selected
 * tab, plain text pills for the rest. Used for status filters (queue),
 * category pickers (POS) and workflow switches (POS Sell/Receipts/Drawer) —
 * anywhere a person picks exactly one of a short list.
 */
export function PillTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: PillTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              active
                ? "bg-[var(--text)] text-[var(--bg)] shadow-[var(--shadow-soft)]"
                : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("ml-1", active ? "opacity-70" : "opacity-60")}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
