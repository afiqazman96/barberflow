"use client";

import { Home, Ticket, User } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PageTransition } from "@/components/layout/page-transition";

const navItems = [
  { href: "/customer/home", label: "Home", icon: Home },
  { href: "/customer/tracking", label: "Queue", icon: Ticket },
  { href: "/customer/profile", label: "Profile", icon: User },
];

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-bg min-h-dvh">
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6 safe-top">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav items={navItems} />
    </div>
  );
}
