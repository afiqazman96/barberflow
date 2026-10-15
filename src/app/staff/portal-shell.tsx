"use client";

import {
  LayoutDashboard,
  Scissors,
  Wallet,
  History,
  User,
} from "lucide-react";
import { QueueSync } from "@/components/domain/queue-sync";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PageTransition } from "@/components/layout/page-transition";
import { NotificationBell } from "@/components/domain/notification-bell";

const navItems = [
  { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/current-service", label: "Current", icon: Scissors },
  { href: "/staff/commission", label: "Commission", icon: Wallet },
  { href: "/staff/history", label: "History", icon: History },
  { href: "/staff/profile", label: "Profile", icon: User },
];

export function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-bg min-h-dvh">
      <QueueSync scope="staff" bookings />
      <div className="safe-top flex justify-end px-4 pt-4">
        <NotificationBell variant="icon" />
      </div>
      <main className="mx-auto max-w-lg px-4 pb-32 pt-2">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav items={navItems} hideFrom={false} />
    </div>
  );
}
