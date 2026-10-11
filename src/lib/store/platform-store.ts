"use client";

import { create } from "zustand";
import type { FeatureKey, Package, SupportTicket, Tenant } from "@/lib/types";
import {
  activateTenant as activateTenantAction,
  addPackage as addPackageAction,
  addSupportTicket as addSupportTicketAction,
  archiveTenant as archiveTenantAction,
  changeTenantPlan as changeTenantPlanAction,
  convertTrialToActive as convertTrialToActiveAction,
  createTenant,
  resetOwnerPassword as resetOwnerPasswordAction,
  restoreTenant as restoreTenantAction,
  suspendTenant as suspendTenantAction,
  toggleFeature as toggleFeatureAction,
  updatePackage as updatePackageAction,
  updateTenant as updateTenantAction,
  updateTicket as updateTicketAction,
} from "@/lib/platform/actions";
import {
  fetchMyTenant,
  fetchPlatformSnapshot,
  fetchPublicPackages,
  type PlatformSnapshot,
} from "@/lib/platform/client";
import { isTrialExpired } from "@/lib/tenant-onboarding";

export interface SubscribeInput {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  packageId: string;
  billing?: "monthly" | "yearly";
  startAs?: "trial" | "active";
}

type Result = { ok: true } | { ok: false; error: string };

interface PlatformState {
  tenants: Tenant[];
  packages: Package[];
  supportTickets: SupportTicket[];
  featureMatrix: Record<string, Record<FeatureKey, boolean>>;
  /** True once the first real snapshot has landed. */
  hydrated: boolean;
  /** The signed-in shop session's own tenant — null until `loadMyTenant`
   * resolves, or for a visitor with no shop session at all. */
  myTenant: Tenant | null;
  myFeatures: Record<FeatureKey, boolean> | null;

  /** Fetch everything from the server and replace local state with it.
   * Platform-session only — for the Super Admin console. */
  refresh: () => Promise<void>;
  /** Plans only, no session required — for the public /pricing page. */
  loadPackages: () => Promise<void>;
  /** The caller's own tenant — for a shop session's portal shell. */
  loadMyTenant: () => Promise<void>;

  addTenant: (
    input: SubscribeInput,
  ) => Promise<{ ok: true; tenant: Tenant; tempPassword: string } | { ok: false; error: string }>;
  updateTenant: (
    id: string,
    patch: Partial<Pick<Tenant, "name" | "ownerName" | "ownerEmail">>,
  ) => Promise<Result>;
  changeTenantPlan: (
    tenantId: string,
    packageId: string,
    billing?: "monthly" | "yearly",
  ) => Promise<Result>;
  convertTrialToActive: (tenantId: string) => Promise<Result>;
  suspendTenant: (tenantId: string) => Promise<Result>;
  activateTenant: (tenantId: string) => Promise<Result>;
  /** New temporary password for the owner, shown once. */
  resetOwnerPassword: (
    tenantId: string,
  ) => Promise<{ ok: true; tenant: Tenant; tempPassword: string } | { ok: false; error: string }>;
  archiveTenant: (tenantId: string) => Promise<Result>;
  restoreTenant: (tenantId: string) => Promise<Result>;

  addPackage: (pkg: Omit<Package, "id">) => Promise<Result>;
  updatePackage: (id: string, patch: Partial<Omit<Package, "id">>) => Promise<Result>;

  toggleFeature: (packageId: string, feature: FeatureKey) => Promise<Result>;
  setFeatureMatrix: (matrix: Record<string, Record<FeatureKey, boolean>>) => void;

  addSupportTicket: (input: {
    tenantId: string;
    subject: string;
    priority: SupportTicket["priority"];
  }) => Promise<Result>;
  updateTicket: (
    id: string,
    patch: Partial<Pick<SupportTicket, "status" | "priority">>,
  ) => Promise<Result>;

  totalMrr: () => number;
  trialCount: () => number;
  expiredTrialCount: () => number;
  openTicketCount: () => number;
}

/** Replace one tenant in the list, or leave the list alone if it isn't there. */
function withTenant(tenants: Tenant[], updated: Tenant): Tenant[] {
  return tenants.map((t) => (t.id === updated.id ? updated : t));
}

const OFFLINE = "Check your connection and try again";

export const usePlatformStore = create<PlatformState>((set, get) => ({
  tenants: [],
  packages: [],
  supportTickets: [],
  featureMatrix: {},
  hydrated: false,
  myTenant: null,
  myFeatures: null,

  refresh: async () => {
    const snapshot = await fetchPlatformSnapshot();
    if (!snapshot) return;
    set({ ...snapshot, hydrated: true });
  },

  loadPackages: async () => {
    const snapshot = await fetchPublicPackages();
    if (!snapshot) return;
    set({ packages: snapshot.packages, featureMatrix: snapshot.featureMatrix });
  },

  loadMyTenant: async () => {
    const result = await fetchMyTenant();
    if (!result) return;
    set({ myTenant: result.tenant, myFeatures: result.features });
  },

  addTenant: async (input) => {
    try {
      const result = await createTenant(input);
      if (!result.ok) return result;
      set((s) => ({ tenants: [result.data.tenant, ...s.tenants] }));
      return { ok: true, tenant: result.data.tenant, tempPassword: result.data.tempPassword };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  updateTenant: async (id, patch) => {
    try {
      const result = await updateTenantAction(id, patch);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  changeTenantPlan: async (tenantId, packageId, billing) => {
    try {
      const result = await changeTenantPlanAction(tenantId, packageId, billing);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  convertTrialToActive: async (tenantId) => {
    try {
      const result = await convertTrialToActiveAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  suspendTenant: async (tenantId) => {
    try {
      const result = await suspendTenantAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  activateTenant: async (tenantId) => {
    try {
      const result = await activateTenantAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  resetOwnerPassword: async (tenantId) => {
    try {
      const result = await resetOwnerPasswordAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true, tenant: result.data.tenant, tempPassword: result.data.tempPassword };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  archiveTenant: async (tenantId) => {
    try {
      const result = await archiveTenantAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  restoreTenant: async (tenantId) => {
    try {
      const result = await restoreTenantAction(tenantId);
      if (!result.ok) return result;
      set((s) => ({ tenants: withTenant(s.tenants, result.data.tenant) }));
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  addPackage: async (pkg) => {
    try {
      const result = await addPackageAction(pkg);
      if (!result.ok) return result;
      await get().refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  updatePackage: async (id, patch) => {
    try {
      const result = await updatePackageAction(id, patch);
      if (!result.ok) return result;
      await get().refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  toggleFeature: async (packageId, feature) => {
    try {
      const result = await toggleFeatureAction(packageId, feature);
      if (!result.ok) return result;
      await get().refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  // Never called from the UI today (no bulk-import screen exists) — kept so
  // the interface has somewhere to grow into; a real one would call
  // `setFeatureMatrix` in `@/lib/platform/actions` and `refresh()`.
  setFeatureMatrix: (featureMatrix) => set({ featureMatrix }),

  addSupportTicket: async (input) => {
    try {
      const result = await addSupportTicketAction(input);
      if (!result.ok) return result;
      await get().refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  updateTicket: async (id, patch) => {
    try {
      const result = await updateTicketAction(id, patch);
      if (!result.ok) return result;
      await get().refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: OFFLINE };
    }
  },

  totalMrr: () =>
    get().tenants.reduce((sum, t) => sum + (t.status === "active" ? t.mrr : 0), 0),
  trialCount: () =>
    get().tenants.filter((t) => t.status === "trial" && !t.archived && !isTrialExpired(t)).length,
  expiredTrialCount: () =>
    get().tenants.filter((t) => !t.archived && isTrialExpired(t)).length,
  openTicketCount: () =>
    get().supportTickets.filter((t) => t.status === "open" || t.status === "in-progress").length,
}));

export type { PlatformSnapshot };
