import "server-only";

import { createHash } from "node:crypto";

import type { StaffRole } from "@/generated/prisma/enums";
import { appBranchStatusFor } from "@/lib/branches/status";
import { prisma } from "@/lib/prisma";
import { appStatusFor } from "@/lib/staff/status";
import type { Branch, BusinessProfile, Chair, StaffMember } from "@/lib/types";

import { dateColumn } from "./queries";

/**
 * Who works where, and the shop's own details — what every screen used to
 * read from the browser's fixtures.
 *
 * Contact details are the owner's business only: everyone else gets their
 * colleagues' names, roles and seats, and a customer gets the barbers.
 */

const ROLE = {
  OWNER: "owner",
  CASHIER: "cashier",
  BARBER: "barber",
} as const satisfies Record<StaffRole, StaffMember["role"]>;

/** The sales figures on a `StaffMember` come from `hydrateSales`, not here. */
const NO_FIGURES = {
  todaySales: 0,
  todayCommission: 0,
  todayCustomers: 0,
  monthlySales: 0,
  monthlyCommission: 0,
} as const;

export async function teamFor(
  tenantId: string,
  opts: {
    /** Limit to these branches (and the shop's owners, who span them all). */
    branchIds?: string[];
    barbersOnly?: boolean;
    withContacts: boolean;
  },
): Promise<StaffMember[]> {
  const rows = await prisma.staff.findMany({
    where: {
      tenantId,
      ...(opts.barbersOnly ? { role: "BARBER" as const, active: true } : {}),
      ...(opts.branchIds
        ? opts.barbersOnly
          ? { branchId: { in: opts.branchIds } }
          : { OR: [{ branchId: { in: opts.branchIds } }, { role: "OWNER" as const }] }
        : {}),
      ...(opts.withContacts ? {} : { active: true }),
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      branchId: true,
      name: true,
      role: true,
      phone: true,
      email: true,
      active: true,
      mustChangePassword: true,
      avatarUrl: true,
      status: true,
      chairId: true,
      specialty: true,
      monthlyTarget: true,
      rating: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    branchId: r.branchId ?? "",
    name: r.name,
    role: ROLE[r.role],
    phone: opts.withContacts ? (r.phone ?? "") : "",
    email: opts.withContacts ? r.email : "",
    // Never sent; the field is a leftover of the prototype's demo logins.
    password: "",
    active: r.active,
    mustChangePassword: opts.withContacts ? r.mustChangePassword : undefined,
    avatar: r.avatarUrl ?? undefined,
    status: appStatusFor(r.status),
    chairId: r.chairId,
    specialty: r.specialty ?? "",
    monthlyTarget: r.monthlyTarget === null ? 0 : Number(r.monthlyTarget),
    rating: r.rating === null ? 0 : Number(r.rating),
    ...NO_FIGURES,
  }));
}

/**
 * Every branch in the shop, with how many are waiting there today and the
 * average wait they were quoted — what the customer's shop cards show.
 */
export async function branchesFor(tenantId: string, today: string): Promise<Branch[]> {
  const rows = await prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      tenantId: true,
      name: true,
      address: true,
      city: true,
      phone: true,
      status: true,
      openHours: true,
      _count: { select: { chairs: true } },
    },
  });
  const waiting = await prisma.queueTicket.groupBy({
    by: ["branchId"],
    where: {
      branchId: { in: rows.map((r) => r.id) },
      queueDate: dateColumn(today),
      status: { in: ["WAITING", "CALLED"] },
    },
    _count: { _all: true },
    _avg: { estimatedWaitMins: true },
  });
  const line = new Map(waiting.map((w) => [w.branchId, w]));

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    address: r.address ?? "",
    city: r.city ?? "",
    phone: r.phone ?? "",
    status: appBranchStatusFor(r.status),
    openHours: r.openHours ?? "",
    chairs: r._count.chairs,
    queueCount: line.get(r.id)?._count._all ?? 0,
    avgWaitMins: Math.round(line.get(r.id)?._avg.estimatedWaitMins ?? 0),
  }));
}

export async function chairsAt(branchIds: string[]): Promise<Chair[]> {
  const rows = await prisma.chair.findMany({
    where: { branchId: { in: branchIds } },
    orderBy: [{ branchId: "asc" }, { number: "asc" }],
    select: {
      id: true,
      branchId: true,
      number: true,
      label: true,
      staff: { select: { id: true } },
    },
  });
  return rows.map(({ staff, ...chair }) => ({ ...chair, staffId: staff?.id ?? null }));
}

/**
 * The shop's name, contacts and logo, as printed on receipts. An uploaded
 * logo is served by `/api/catalog/image/logo/...` rather than inlined, like
 * the catalogue's pictures; its version is a hash of the image itself.
 */
export async function businessProfileFor(tenantId: string): Promise<BusinessProfile> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logoUrl: true,
      settings: {
        select: { phone: true, email: true, address: true, taxId: true, logoUrl: true },
      },
    },
  });
  const logo = tenant?.settings?.logoUrl ?? tenant?.logoUrl ?? null;
  const logoUrl = !logo
    ? undefined
    : /^https?:\/\//i.test(logo)
      ? logo
      : `/api/catalog/image/logo/${tenantId}?v=${createHash("sha1").update(logo).digest("hex").slice(0, 12)}`;

  return {
    name: tenant?.name ?? "",
    phone: tenant?.settings?.phone ?? "",
    email: tenant?.settings?.email ?? "",
    address: tenant?.settings?.address ?? "",
    taxId: tenant?.settings?.taxId ?? "",
    logoUrl,
  };
}
