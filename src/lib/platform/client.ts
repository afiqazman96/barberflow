import type { FeatureKey, Invoice, Package, SupportTicket, Tenant } from "@/lib/types";

/**
 * The browser's side of the Super Admin console: one fetch for the whole
 * picture. No Realtime — see `/api/platform`'s own note.
 */

export type PlatformSnapshot = {
  tenants: Tenant[];
  packages: Package[];
  featureMatrix: Record<string, Record<FeatureKey, boolean>>;
  supportTickets: SupportTicket[];
  invoices: Invoice[];
};

export async function fetchPlatformSnapshot(): Promise<PlatformSnapshot | null> {
  try {
    const response = await fetch("/api/platform", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as PlatformSnapshot;
  } catch {
    return null;
  }
}

/** Plans only — what a public visitor on /pricing is allowed to see. */
export async function fetchPublicPackages(): Promise<Pick<
  PlatformSnapshot,
  "packages" | "featureMatrix"
> | null> {
  try {
    const response = await fetch("/api/platform/packages", { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** A signed-in shop session's own tenant and feature row. */
export async function fetchMyTenant(): Promise<{
  tenant: Tenant;
  features: Record<FeatureKey, boolean>;
  invoices: Invoice[];
} | null> {
  try {
    const response = await fetch("/api/platform/my-tenant", { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** A signed-in shop session's own support tickets. */
export async function fetchMyTickets(): Promise<{ tickets: SupportTicket[] } | null> {
  try {
    const response = await fetch("/api/support/mine", { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
