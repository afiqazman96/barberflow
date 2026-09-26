"use client";

import {
  LayoutDashboard,
  ListOrdered,
  CalendarDays,
  ShoppingCart,
  UserCircle,
  Users,
  Percent,
  Package,
  BarChart3,
  CreditCard,
  Settings,
  Menu,
  Building2,
  CalendarClock,
} from "lucide-react";
import { AppShell, Sidebar } from "@/components/layout/app-shell";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useAppStore } from "@/lib/store/app-store";
import { DEMO_TENANT_ID, usePlatformStore } from "@/lib/store/platform-store";
import type { FeatureKey } from "@/lib/types";

// The demo shop ("Fade House") is DEMO_TENANT_ID in the platform store — its
// package's feature matrix is what Super Admin > Features actually toggles.

// Nav items whose visibility is gated by a package feature flag. Anything not
// listed here is always shown (core flows every package includes).
const FEATURE_GATED_HREFS: Record<string, FeatureKey> = {
  "/owner/commission": "commission",
  "/owner/inventory": "inventory",
};

function useGatedNavItems(items: typeof navItems) {
  const demoTenant = usePlatformStore((s) =>
    s.tenants.find((t) => t.id === DEMO_TENANT_ID),
  );
  const featureMatrix = usePlatformStore((s) => s.featureMatrix);
  const row = demoTenant ? featureMatrix[demoTenant.packageId] : undefined;
  return items.filter((item) => {
    const feature = FEATURE_GATED_HREFS[item.href];
    if (!feature) return true;
    return row?.[feature] ?? true;
  });
}

const navItems = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/owner/queue", label: "Queue", icon: ListOrdered },
  { href: "/owner/appointment", label: "Appointment", icon: CalendarDays },
  // Sell, Sales & Receipts and Cash Drawer are one POS workflow — grouped
  // under this single entry as tabs (see PosSubnav) instead of three
  // separate sidebar items.
  { href: "/owner/pos", label: "Point of Sale", icon: ShoppingCart },
  { href: "/owner/customer", label: "Customer", icon: UserCircle },
  { href: "/owner/staff", label: "Staff", icon: Users },
  { href: "/owner/roster", label: "Roster", icon: CalendarClock },
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

/**
 * An owner can have several branches; every screen underneath (Dashboard,
 * Queue, POS, Reports, Staff) is scoped to whichever one is active here.
 * With only one branch this collapses to a disabled label instead of an
 * empty dropdown.
 */
function BranchSwitcher() {
  const branches = useAppStore((s) => s.branches);
  const branchId = useAppStore((s) => s.branchId);
  const setBranchId = useAppStore((s) => s.setBranchId);

  if (branches.length <= 1) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{branches[0]?.name ?? "Branch"}</span>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2">
      <label className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
        <Building2 className="h-3 w-3" />
        Viewing branch
      </label>
      <select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="w-full truncate rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm font-medium"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = useAppStore((s) => s.businessProfile);
  const gatedNavItems = useGatedNavItems(navItems);

  return (
    <AppShell
      sidebar={
        <Sidebar
          title={business.name}
          subtitle="Owner"
          logoUrl={business.logoUrl}
          items={gatedNavItems}
          beforeNav={<BranchSwitcher />}
        />
      }
      bottomNav={<BottomNav items={bottomNavItems} />}
    >
      {children}
    </AppShell>
  );
}
