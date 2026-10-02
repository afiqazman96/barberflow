import "server-only";

import type { MembershipTier } from "@/generated/prisma/enums";
import { instantToShopTime } from "@/lib/bookings/time";
import { prisma } from "@/lib/prisma";
import type { Customer, MembershipPlan, Product, Service } from "@/lib/types";

/**
 * The catalogue and the customer list, as the screens know them.
 *
 * Pictures are not inlined: an uploaded one is a data URL of up to ~700KB, and
 * the snapshots carrying the catalogue are re-read on every Realtime poke. The
 * DTO points at `/api/catalog/image/...` instead, versioned by the row's
 * `updatedAt` so the browser can cache it for good.
 */

export type ImageKind = "service" | "product";

/** The newest customers first; enough for any one shop's counter. */
const CUSTOMER_LIMIT = 5000;

export const TIER_FROM_PRISMA = {
  NONE: "none",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
} as const satisfies Record<MembershipTier, Customer["membership"]>;

function imageUrlFor(
  kind: ImageKind,
  row: { id: string; imageUrl: string | null; updatedAt: Date },
): string | undefined {
  if (!row.imageUrl) return undefined;
  // A plain web address (the seed's, or a CDN) is served as it is.
  if (/^https?:\/\//i.test(row.imageUrl)) return row.imageUrl;
  return `/api/catalog/image/${kind}/${row.id}?v=${row.updatedAt.getTime()}`;
}

/** What the shop sells across the counter and books for. */
export async function servicesFor(tenantId: string): Promise<Service[]> {
  const rows = await prisma.service.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      durationMins: true,
      price: true,
      membershipPrice: true,
      popular: true,
      imageUrl: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? "",
    durationMins: r.durationMins,
    price: Number(r.price),
    membershipPrice: Number(r.membershipPrice),
    popular: r.popular || undefined,
    imageUrl: imageUrlFor("service", r),
  }));
}

export async function productsFor(tenantId: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { tenantId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      sku: true,
      price: true,
      stock: true,
      imageUrl: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? "",
    sku: r.sku,
    price: Number(r.price),
    stock: r.stock,
    imageUrl: imageUrlFor("product", r),
  }));
}

/** The plans on sale, each with how many customers hold it. */
export async function membershipPlansFor(tenantId: string): Promise<MembershipPlan[]> {
  const rows = await prisma.membershipPlan.findMany({
    where: { tenantId, active: true },
    orderBy: { price: "asc" },
    select: {
      id: true,
      name: true,
      tier: true,
      price: true,
      discountPercent: true,
      benefits: true,
      _count: { select: { customers: true } },
    },
  });
  return rows.flatMap((r) =>
    r.tier === "NONE"
      ? []
      : [
          {
            id: r.id,
            name: r.name,
            tier: TIER_FROM_PRISMA[r.tier] as MembershipPlan["tier"],
            price: Number(r.price),
            discountPercent: Number(r.discountPercent),
            benefits: r.benefits,
            members: r._count.customers,
          },
        ],
  );
}

/**
 * The customer list for the owner and the counter. Visits and spend are not
 * stored — they are the customer's sales, voids left out: a visit is a sale
 * with a service on it.
 */
export async function customersFor(tenantId: string, timeZone: string): Promise<Customer[]> {
  const [rows, spend, visits] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: CUSTOMER_LIMIT,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        membership: true,
        lastVisitAt: true,
        preferredStaffId: true,
        notes: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { tenantId, voidedAt: null, customerId: { not: null } },
      _sum: { total: true },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        tenantId,
        voidedAt: null,
        customerId: { not: null },
        items: { some: { type: "SERVICE" } },
      },
      _count: { _all: true },
    }),
  ]);

  const spent = new Map(spend.map((s) => [s.customerId, Number(s._sum.total ?? 0)]));
  const visited = new Map(visits.map((v) => [v.customerId, v._count._all]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    email: r.email ?? undefined,
    membership: TIER_FROM_PRISMA[r.membership],
    visits: visited.get(r.id) ?? 0,
    totalSpent: Math.round((spent.get(r.id) ?? 0) * 100) / 100,
    lastVisit: r.lastVisitAt ? instantToShopTime(r.lastVisitAt, timeZone).date : "",
    preferredStaffId: r.preferredStaffId ?? undefined,
    notes: r.notes ?? undefined,
  }));
}
