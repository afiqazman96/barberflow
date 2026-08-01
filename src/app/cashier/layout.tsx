"use client";

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UserCircle,
  ShoppingCart,
  CreditCard,
  ListOrdered,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";

const navItems = [
  { href: "/cashier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cashier/queue", label: "Queue", icon: ListOrdered },
  { href: "/cashier/appointment", label: "Appointment", icon: CalendarDays },
  { href: "/cashier/customer", label: "Customer", icon: UserCircle },
  { href: "/cashier/pos", label: "POS", icon: ShoppingCart },
  { href: "/cashier/payment", label: "Payment", icon: CreditCard },
];

const bottomNavItems = [
  { href: "/cashier/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/cashier/queue", label: "Queue", icon: ListOrdered },
  { href: "/cashier/appointment", label: "Appt", icon: CalendarDays },
  { href: "/cashier/customer", label: "Clients", icon: Users },
  { href: "/cashier/pos", label: "POS", icon: ShoppingCart },
  { href: "/cashier/payment", label: "Pay", icon: CreditCard },
];

export default function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      sidebar={
        <Sidebar
          title="Fade House"
          subtitle="Cashier Portal"
          items={navItems}
          footerHref="/"
        />
      }
      bottomNav={<BottomNav items={bottomNavItems} />}
    >
      {children}
    </AppShell>
  );
}
