import "server-only";

import { prisma } from "@/lib/prisma";
import type { FeatureKey, Package, SupportTicket, Tenant } from "@/lib/types";

import { FEATURE_FROM_PRISMA, packageDto, tenantDto, ticketDto } from "./dto";

/**
 * A shop session's own tenant, with its package's feature row — what the
 * portal shell needs to block a suspended shop and gate nav items by plan.
 * Scoped by the caller's own `tenantId`, never a client-supplied one.
 */
export async function myTenantFor(
  tenantId: string,
): Promise<{ tenant: Tenant; features: Record<FeatureKey, boolean> } | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      ...TENANT_INCLUDE,
      package: {
        select: { name: true, featureFlags: { select: { feature: true, enabled: true } } },
      },
    },
  });
  if (!t) return null;
  const features = {} as Record<FeatureKey, boolean>;
  for (const f of t.package.featureFlags) features[FEATURE_FROM_PRISMA[f.feature]] = f.enabled;
  return {
    tenant: tenantDto(t, { branches: t._count.branches, staff: t._count.staff }, t.staff[0] ?? null),
    features,
  };
}

const TENANT_INCLUDE = {
  package: { select: { name: true } },
  _count: { select: { branches: true, staff: true } },
  staff: {
    where: { role: "OWNER" as const },
    select: { email: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
    take: 1,
  },
};

/** One tenant, freshly computed — what a mutating action hands back so the
 * client never has to re-derive status/mrr/trial logic itself. */
export async function tenantByIdDto(tenantId: string): Promise<Tenant | null> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: TENANT_INCLUDE,
  });
  if (!t) return null;
  return tenantDto(t, { branches: t._count.branches, staff: t._count.staff }, t.staff[0] ?? null);
}

/** Every tenant, newest first, with its owner's account status. */
export async function tenantsFor(): Promise<Tenant[]> {
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: TENANT_INCLUDE,
  });
  return rows.map((t) =>
    tenantDto(
      t,
      { branches: t._count.branches, staff: t._count.staff },
      t.staff[0] ?? null,
    ),
  );
}

/** Every package, and the feature matrix keyed by package id. */
export async function packagesFor(): Promise<{
  packages: Package[];
  featureMatrix: Record<string, Record<FeatureKey, boolean>>;
}> {
  const rows = await prisma.package.findMany({
    orderBy: { price: "asc" },
    include: { featureFlags: { select: { feature: true, enabled: true } } },
  });
  const packages: Package[] = [];
  const featureMatrix: Record<string, Record<FeatureKey, boolean>> = {};
  for (const row of rows) {
    const { pkg, features } = packageDto(row, row.featureFlags);
    packages.push(pkg);
    featureMatrix[row.id] = features;
  }
  return { packages, featureMatrix };
}

/** Every support ticket, newest first. */
export async function supportTicketsFor(): Promise<SupportTicket[]> {
  const rows = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { name: true } } },
  });
  return rows.map(ticketDto);
}
