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
        "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur-xl",
        hideFrom === "lg" && "lg:hidden",
        hideFrom === "md" && "md:hidden",
      )}
    >      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isMenu = item.action === "menu";
          const active =
            !isMenu &&
            !!item.href &&
            (pathname === item.href || pathname.startsWith(item.href + "/"));

          if (isMenu) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => mobileNav?.setOpen(true)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                  mobileNav?.open
                    ? "text-[var(--gold-soft)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-muted)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    mobileNav?.open && "drop-shadow-[0_0_8px_rgba(201,162,39,0.5)]",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                active
                  ? "text-[var(--gold-soft)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-muted)]",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  active && "drop-shadow-[0_0_8px_rgba(201,162,39,0.5)]",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
