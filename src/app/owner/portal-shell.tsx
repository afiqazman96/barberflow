"use client";

import {
  LayoutDashboard,
  ListOrdered,
  CalendarDays,
  ShoppingCart,
  Receipt,
  UserCircle,
  Users,
  Percent,
  Package,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAppStore } from "@/lib/store/app-store";

const navItems = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/queue", label: "Queue", icon: ListOrdered },
  { href: "/owner/appointment", label: "Appointment", icon: CalendarDays },
  { href: "/owner/pos", label: "POS", icon: ShoppingCart },
  { href: "/owner/sales", label: "Sales & Receipts", icon: Receipt },
  { href: "/owner/customer", label: "Customer", icon: UserCircle },
  { href: "/owner/staff", label: "Staff", icon: Users },
  { href: "/owner/commission", label: "Commission", icon: Percent },
  { href: "/owner/inventory", label: "Inventory", icon: Package },
  { href: "/owner/reports", label: "Reports", icon: BarChart3 },
  { href: "/owner/billing", label: "Billing", icon: CreditCard },
  { href: "/owner/settings", label: "Settings", icon: Settings },
];

const bottomNavItems = [
  { href: "/owner/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/owner/queue", label: "Queue", icon: ListOrdered },
  { href: "/owner/appointment", label: "Appt", icon: CalendarDays },
  { href: "/owner/pos", label: "POS", icon: ShoppingCart },
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
          subtitle="Owner"
          logoUrl={business.logoUrl}
          items={navItems}
        />
      }
      bottomNav={<BottomNav items={bottomNavItems} />}
    >
      {children}
    </AppShell>
  );
}
