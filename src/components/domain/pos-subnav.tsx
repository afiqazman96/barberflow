"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Receipt, Wallet, type LucideIcon } from "lucide-react";

const TABS: { seg: "sell" | "receipts" | "drawer"; label: string; icon: LucideIcon }[] = [
  { seg: "sell", label: "Sell", icon: ShoppingCart },
  { seg: "receipts", label: "Sales & Receipts", icon: Receipt },
  { seg: "drawer", label: "Cash Drawer", icon: Wallet },
];

/**
 * Shared sub-nav for the POS section: selling, receipts and the cash drawer
 * are one workflow, not three unrelated pages, so they live under one
 * sidebar entry (`base`, e.g. "/owner/pos") with tabs to switch between them.
 */
export function PosSubnav({ base }: { base: string }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-4 pt-3 md:px-6">
      <nav className="flex gap-2 overflow-x-auto pb-3">
        {TABS.map((tab) => {
          const href = tab.seg === "sell" ? base : `${base}/${tab.seg}`;
          const active =
            tab.seg === "sell" ? pathname === base : pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.seg}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[var(--gold)]/15 text-[var(--gold-soft)] ring-1 ring-[var(--gold)]/30"
                  : "bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)] hover:text-[var(--text)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
