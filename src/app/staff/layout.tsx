"use client";

import {
  LayoutDashboard,
  Scissors,
  Wallet,
  History,
  User,
} from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PageTransition } from "@/components/layout/page-transition";

const navItems = [
  { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/current-service", label: "Current", icon: Scissors },
  { href: "/staff/commission", label: "Commission", icon: Wallet },
  { href: "/staff/history", label: "History", icon: History },
  { href: "/staff/profile", label: "Profile", icon: User },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-bg min-h-dvh">
      <main className="safe-top mx-auto max-w-lg px-4 pb-24 pt-6">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav items={navItems} hideFrom={false} />
    </div>
  );
}
