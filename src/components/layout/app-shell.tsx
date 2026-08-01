"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, Scissors, Bell, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar({
  title,
  subtitle,
  items,
  footerHref = "/",
  footerLabel = "Sign out",
}: {
  title: string;
  subtitle?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
  footerHref?: string;
  footerLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] lg:flex">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gold-gradient text-[#0c0b09]">
          <Scissors className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-bold tracking-tight">{title}</p>
          {subtitle && (
            <p className="text-xs text-[var(--text-faint)]">{subtitle}</p>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== items[0]?.href && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-[var(--gold)]/10 text-[var(--gold-soft)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)]">
          <Bell className="h-4 w-4" />
          Notifications
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--gold)]/20 px-1.5 text-xs text-[var(--gold-soft)]">
            3
          </span>
        </div>
        <Button asChild variant="ghost" className="w-full justify-start" size="sm">
          <Link href={footerHref}>
            <LogOut className="h-4 w-4" />
            {footerLabel}
          </Link>
        </Button>
      </div>
    </aside>
  );
}

export function Topbar({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/90 px-4 backdrop-blur-xl md:h-16 md:px-6">
      <h1 className="font-display text-lg font-semibold tracking-tight md:text-xl">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AppShell({
  sidebar,
  bottomNav,
  children,
}: {
  sidebar: React.ReactNode;
  bottomNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="app-bg flex min-h-dvh">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className={cn("flex-1 overflow-y-auto", bottomNav && "pb-24 lg:pb-6")}>
          {children}
        </main>
        {bottomNav}
      </div>
    </div>
  );
}
