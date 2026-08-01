"use client";

import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  ToggleLeft,
  HeadphonesIcon,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenant", label: "Tenants", icon: Building2 },
  { href: "/super-admin/subscription", label: "Subscription", icon: CreditCard },
  { href: "/super-admin/packages", label: "Packages", icon: Package },
  { href: "/super-admin/features", label: "Features", icon: ToggleLeft },
  { href: "/super-admin/support", label: "Support", icon: HeadphonesIcon },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      sidebar={
        <Sidebar
          title="BarberFlow"
          subtitle="Platform"
          items={navItems}
          footerHref="/platform"
          footerLabel="Sign out"
        />
      }
    >
      {children}
    </AppShell>
  );
}
