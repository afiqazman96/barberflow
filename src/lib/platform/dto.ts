import "server-only";

import type {
  BillingCycle,
  FeatureKey as PrismaFeatureKey,
  TenantStatus,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";
import type { Package as PrismaPackage } from "@/generated/prisma/client";
import type {
  FeatureKey,
  OwnerAccount,
  Package,
  SupportTicket,
  Tenant,
} from "@/lib/types";

/**
 * Prisma rows to the client shapes `platform-store.ts` already expects, so the
 * Super Admin screens do not change — only where their data comes from.
 */

export const STATUS_FROM_PRISMA: Record<TenantStatus, Tenant["status"]> = {
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
};
export const STATUS_TO_PRISMA: Record<Tenant["status"], TenantStatus> = {
  active: "ACTIVE",
  trial: "TRIAL",
  suspended: "SUSPENDED",
};

export const BILLING_FROM_PRISMA: Record<BillingCycle, Tenant["billing"]> = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
};
export const BILLING_TO_PRISMA: Record<Tenant["billing"], BillingCycle> = {
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

export const FEATURE_FROM_PRISMA: Record<PrismaFeatureKey, FeatureKey> = {
  QUEUE: "queue",
  BOOKING: "booking",
  POS: "pos",
  COMMISSION: "commission",
  INVENTORY: "inventory",
  MEMBERSHIP: "membership",
  ANALYTICS: "analytics",
  API: "api",
  WHITE_LABEL: "white-label",
};
export const FEATURE_TO_PRISMA: Record<FeatureKey, PrismaFeatureKey> = {
  queue: "QUEUE",
  booking: "BOOKING",
  pos: "POS",
  commission: "COMMISSION",
  inventory: "INVENTORY",
  membership: "MEMBERSHIP",
  analytics: "ANALYTICS",
  api: "API",
  "white-label": "WHITE_LABEL",
};

export const PRIORITY_FROM_PRISMA: Record<TicketPriority, SupportTicket["priority"]> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};
export const PRIORITY_TO_PRISMA: Record<SupportTicket["priority"], TicketPriority> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export const TICKET_STATUS_FROM_PRISMA: Record<TicketStatus, SupportTicket["status"]> = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
};
export const TICKET_STATUS_TO_PRISMA: Record<SupportTicket["status"], TicketStatus> = {
  open: "OPEN",
  "in-progress": "IN_PROGRESS",
  resolved: "RESOLVED",
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  packageId: string;
  status: TenantStatus;
  billing: BillingCycle;
  mrr: unknown;
  ownerName: string;
  ownerEmail: string;
  trialEndsAt: Date | null;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  package: { name: string };
};

type OwnerStaffRow = {
  email: string;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function ownerAccountFor(owner: OwnerStaffRow | null): OwnerAccount | undefined {
  if (!owner) return undefined;
  return {
    loginEmail: owner.email,
    mustChangePassword: owner.mustChangePassword,
    status: owner.lastLoginAt ? "active" : "awaiting-first-login",
    issuedAt: owner.createdAt.toISOString(),
    // Real, not a demo credential — but the password itself is only ever
    // returned once, from `createTenant`/`resetOwnerPassword`, never stored.
    provisioned: true,
  };
}

export function tenantDto(
  t: TenantRow,
  counts: { branches: number; staff: number },
  owner: OwnerStaffRow | null,
): Tenant {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logo: t.logoUrl ?? undefined,
    plan: t.package.name,
    packageId: t.packageId,
    status: STATUS_FROM_PRISMA[t.status],
    branches: counts.branches,
    staff: counts.staff,
    mrr: Number(t.mrr),
    ownerName: t.ownerName,
    ownerEmail: t.ownerEmail,
    ownerAccount: ownerAccountFor(owner),
    billing: BILLING_FROM_PRISMA[t.billing],
    trialEndsAt: t.trialEndsAt?.toISOString().slice(0, 10),
    createdAt: t.createdAt.toISOString().slice(0, 10),
    archived: t.archived,
    archivedAt: t.archivedAt?.toISOString().slice(0, 10),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function packageDto(
  p: PrismaPackage,
  features: { feature: PrismaFeatureKey; enabled: boolean }[],
): { pkg: Package; features: Record<FeatureKey, boolean> } {
  const featureRow = {} as Record<FeatureKey, boolean>;
  for (const f of features) featureRow[FEATURE_FROM_PRISMA[f.feature]] = f.enabled;
  return {
    pkg: {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      yearlyPrice: Number(p.yearlyPrice),
      billing: "monthly",
      features: p.features,
      popular: p.popular || undefined,
      maxBranches: p.maxBranches,
      maxStaff: p.maxStaff,
      trialDays: p.trialDays,
    },
    features: featureRow,
  };
}

export function ticketDto(t: {
  id: string;
  tenantId: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  tenant: { name: string };
}): SupportTicket {
  return {
    id: t.id,
    tenantId: t.tenantId,
    tenantName: t.tenant.name,
    subject: t.subject,
    priority: PRIORITY_FROM_PRISMA[t.priority],
    status: TICKET_STATUS_FROM_PRISMA[t.status],
    createdAt: t.createdAt.toISOString().slice(0, 10),
  };
}
