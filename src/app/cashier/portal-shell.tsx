"use client";

import {
  LayoutDashboard,
  CalendarDays,
  UserCircle,
  ShoppingCart,
  ListOrdered,
  Menu,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QueueSync } from "@/components/domain/queue-sync";
import { CashierShiftBanner } from "@/components/domain/cashier-shift";
import { useAppStore } from "@/lib/store/app-store";

const navItems = [
  { href: "/cashier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cashier/queue", label: "Queue", icon: ListOrdered },
  { href: "/cashier/appointment", label: "Appointment", icon: CalendarDays },
  { href: "/cashier/customer", label: "Customer", icon: UserCircle },
  // Sell, Payment, Sales & Receipts and Cash Drawer are one POS workflow —
  // payment happens in a modal over the cart, and the rest are grouped as
  // tabs (see PosSubnav) instead of separate sidebar items.
  { href: "/cashier/pos", label: "Point of Sale", icon: ShoppingCart },
];

const bottomNavItems = [
  { href: "/cashier/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/cashier/queue", label: "Queue", icon: ListOrdered },
  { href: "/cashier/pos", label: "POS", icon: ShoppingCart },
  { label: "Menu", icon: Menu, action: "menu" as const },
];

export function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = useAppStore((s) => s.businessProfile);

  return (
    <AppShell
      sidebar={
        <Sidebar
          title={business.name}
          subtitle="Cashier Portal"
          logoUrl={business.logoUrl}
          items={navItems}
        />
      }
      bottomNav={<BottomNav items={bottomNavItems} />}
    >
      <QueueSync scope="staff" bookings />
      <CashierShiftBanner />
      {children}
    </AppShell>
  );
}
