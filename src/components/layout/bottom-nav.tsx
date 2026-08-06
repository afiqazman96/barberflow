"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/components/layout/app-shell";

export type BottomNavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Opens the full sidebar drawer instead of navigating */
  action?: "menu";
};

export function BottomNav({
  items,
  /** Hide bottom nav from this breakpoint up. Use false for staff (no desktop sidebar). */
  hideFrom = "lg",
}: {
  items: BottomNavItem[];
  hideFrom?: "md" | "lg" | false;
}) {
  const pathname = usePathname();
  const mobileNav = useMobileNav();

  return (
    <nav
      className={cn(
        "safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-2",
        hideFrom === "lg" && "lg:hidden",
        hideFrom === "md" && "md:hidden",
      )}
    >
      <div className="pointer-events-auto mx-auto max-w-md">
        <div className="flex items-stretch justify-around gap-0.5 rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-elevated)]/95 px-2 py-2 shadow-[0_12px_40px_rgba(28,25,23,0.12)] backdrop-blur-xl">
          {items.map((item) => {
            const Icon = item.icon;
            const isMenu = item.action === "menu";
            const active =
              !isMenu &&
              !!item.href &&
              (pathname === item.href || pathname.startsWith(item.href + "/"));

            const itemClass = cn(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-medium transition",
              (isMenu ? mobileNav?.open : active)
                ? "bg-[var(--gold)]/12 text-[var(--gold-soft)]"
                : "text-[var(--text-faint)] hover:text-[var(--text-muted)]",
            );

            if (isMenu) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => mobileNav?.setOpen(true)}
                  className={itemClass}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href!} className={itemClass}>
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
