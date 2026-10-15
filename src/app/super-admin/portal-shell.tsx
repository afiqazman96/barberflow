"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Receipt,
  ToggleLeft,
  HeadphonesIcon,
  Menu,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { usePlatformStore } from "@/lib/store/platform-store";

/**
 * A lightweight stand-in for the tenant-side `<NotificationBell>` — super
 * admins don't get generated Notification rows (those are tenant concerns),
 * so this just surfaces the open-ticket count the platform store already
 * computes, and links straight to the real Support inbox.
 */
function OpenTicketsBell() {
  const openCount = usePlatformStore((s) => s.openTicketCount());
  return (
    <Link
      href="/super-admin/support"
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
    >
      <Bell className="h-4 w-4" />
      Open tickets
      {openCount > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--gold)]/20 px-1.5 text-xs text-[var(--gold-soft)]">
          {openCount}
        </span>
      )}
    </Link>
  );
}

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenant", label: "Tenants", icon: Building2 },
  { href: "/super-admin/subscription", label: "Subscription", icon: CreditCard },
  { href: "/super-admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/super-admin/packages", label: "Packages", icon: Package },
  { href: "/super-admin/features", label: "Features", icon: ToggleLeft },
  { href: "/super-admin/support", label: "Support", icon: HeadphonesIcon },
];

const bottomNavItems = [
  { href: "/super-admin/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/super-admin/tenant", label: "Tenants", icon: Building2 },
  { href: "/super-admin/subscription", label: "Plans", icon: CreditCard },
  { href: "/super-admin/support", label: "Support", icon: HeadphonesIcon },
  { label: "Menu", icon: Menu, action: "menu" as const },
];

export function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const refresh = usePlatformStore((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AppShell
      sidebar={
        <Sidebar
          title="BarberFlow"
          subtitle="Platform"
          items={navItems}
          footerLabel="Sign out"
          bell={<OpenTicketsBell />}
        />
      }
      bottomNav={<BottomNav items={bottomNavItems} />}
    >
      {children}
    </AppShell>
  );
}
