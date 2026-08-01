"use client";

import { create } from "zustand";
import type {
  FeatureKey,
  Package,
  SupportTicket,
  Tenant,
} from "@/lib/types";
import {
  DEFAULT_FEATURE_MATRIX,
  PACKAGES,
  SUPPORT_TICKETS,
  TENANTS,
} from "@/lib/mock/data";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mrrFor(
  pkg: Package,
  billing: "monthly" | "yearly",
  status: Tenant["status"],
) {
  if (status === "suspended" || status === "trial") return 0;
  return billing === "yearly"
    ? Math.round((pkg.yearlyPrice / 12) * 100) / 100
    : pkg.price;
}

export interface SubscribeInput {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  packageId: string;
  billing?: "monthly" | "yearly";
  startAs?: "trial" | "active";
  branches?: number;
  staff?: number;
}

interface PlatformState {
  tenants: Tenant[];
  packages: Package[];
  supportTickets: SupportTicket[];
  featureMatrix: Record<string, Record<string, boolean>>;

  addTenant: (input: SubscribeInput) => Tenant;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  changeTenantPlan: (
    tenantId: string,
    packageId: string,
    billing?: "monthly" | "yearly",
  ) => void;
  convertTrialToActive: (tenantId: string) => void;
  suspendTenant: (tenantId: string) => void;
  activateTenant: (tenantId: string) => void;

  addPackage: (pkg: Omit<Package, "id">) => Package;
  updatePackage: (id: string, patch: Partial<Package>) => void;

  toggleFeature: (packageId: string, feature: FeatureKey) => void;
  setFeatureMatrix: (matrix: Record<string, Record<string, boolean>>) => void;

  addSupportTicket: (input: {
    tenantId: string;
    subject: string;
    priority: SupportTicket["priority"];
  }) => SupportTicket;
  updateTicket: (id: string, patch: Partial<SupportTicket>) => void;

  totalMrr: () => number;
  trialCount: () => number;
  openTicketCount: () => number;
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  tenants: TENANTS.map((t) => ({ ...t })),
  packages: PACKAGES.map((p) => ({ ...p })),
  supportTickets: SUPPORT_TICKETS.map((t) => ({ ...t })),
  featureMatrix: structuredClone(DEFAULT_FEATURE_MATRIX),

  addTenant: (input) => {
    const pkg =
      get().packages.find((p) => p.id === input.packageId) ?? get().packages[0];
    const billing = input.billing ?? "monthly";
    const startAs = input.startAs ?? "trial";
    const status: Tenant["status"] = startAs;
    const tenant: Tenant = {
      id: `t-${Date.now()}`,
      name: input.businessName.trim(),
      slug: slugify(input.businessName),
      plan: pkg.name,
      packageId: pkg.id,
      status,
      branches: input.branches ?? 1,
      staff: input.staff ?? 1,
      mrr: mrrFor(pkg, billing, status),
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      billing,
      trialEndsAt: status === "trial" ? addDays(pkg.trialDays) : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set((s) => ({ tenants: [tenant, ...s.tenants] }));
    return tenant;
  },

  updateTenant: (id, patch) =>
    set((s) => ({
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  changeTenantPlan: (tenantId, packageId, billing) => {
    const pkg = get().packages.find((p) => p.id === packageId);
    if (!pkg) return;
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const nextBilling = billing ?? t.billing;
        return {
          ...t,
          packageId: pkg.id,
          plan: pkg.name,
          billing: nextBilling,
          mrr: mrrFor(pkg, nextBilling, t.status),
        };
      }),
    }));
  },

  convertTrialToActive: (tenantId) => {
    const tenant = get().tenants.find((t) => t.id === tenantId);
    const pkg = get().packages.find((p) => p.id === tenant?.packageId);
    if (!tenant || !pkg) return;
    set((s) => ({
      tenants: s.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              status: "active" as const,
              trialEndsAt: undefined,
              mrr: mrrFor(pkg, t.billing, "active"),
            }
          : t,
      ),
    }));
  },

  suspendTenant: (tenantId) =>
    set((s) => ({
      tenants: s.tenants.map((t) =>
        t.id === tenantId
          ? { ...t, status: "suspended" as const, mrr: 0 }
          : t,
      ),
    })),

  activateTenant: (tenantId) => {
    const tenant = get().tenants.find((t) => t.id === tenantId);
    const pkg = get().packages.find((p) => p.id === tenant?.packageId);
    if (!tenant || !pkg) return;
    set((s) => ({
      tenants: s.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              status: "active" as const,
              mrr: mrrFor(pkg, t.billing, "active"),
            }
          : t,
      ),
    }));
  },

  addPackage: (pkg) => {
    const created: Package = { ...pkg, id: `pkg-${Date.now()}` };
    set((s) => ({
      packages: [...s.packages, created],
      featureMatrix: {
        ...s.featureMatrix,
        [created.id]: {
          queue: true,
          booking: true,
          pos: true,
          commission: false,
          inventory: false,
          membership: false,
          analytics: false,
          api: false,
          "white-label": false,
        },
      },
    }));
    return created;
  },

  updatePackage: (id, patch) =>
    set((s) => {
      const packages = s.packages.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      );
      const updated = packages.find((p) => p.id === id);
      // Keep tenant plan name + MRR in sync when price/name changes
      const tenants = s.tenants.map((t) => {
        if (t.packageId !== id || !updated) return t;
        return {
          ...t,
          plan: updated.name,
          mrr: mrrFor(updated, t.billing, t.status),
        };
      });
      return { packages, tenants };
    }),

  toggleFeature: (packageId, feature) =>
    set((s) => {
      const row = s.featureMatrix[packageId] ?? {};
      return {
        featureMatrix: {
          ...s.featureMatrix,
          [packageId]: { ...row, [feature]: !row[feature] },
        },
      };
    }),

  setFeatureMatrix: (featureMatrix) => set({ featureMatrix }),

  addSupportTicket: ({ tenantId, subject, priority }) => {
    const tenant = get().tenants.find((t) => t.id === tenantId);
    const ticket: SupportTicket = {
      id: `tk-${Date.now()}`,
      tenantId,
      tenantName: tenant?.name ?? "Unknown",
      subject: subject.trim(),
      priority,
      status: "open",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set((s) => ({ supportTickets: [ticket, ...s.supportTickets] }));
    return ticket;
  },

  updateTicket: (id, patch) =>
    set((s) => ({
      supportTickets: s.supportTickets.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    })),

  totalMrr: () =>
    get().tenants.reduce(
      (sum, t) => sum + (t.status === "active" ? t.mrr : 0),
      0,
    ),
  trialCount: () => get().tenants.filter((t) => t.status === "trial").length,
  openTicketCount: () =>
    get().supportTickets.filter(
      (t) => t.status === "open" || t.status === "in-progress",
    ).length,
}));
