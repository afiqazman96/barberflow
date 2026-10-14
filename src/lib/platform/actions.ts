"use server";

import { revalidatePath } from "next/cache";

import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";
import type { ActionResult } from "@/lib/auth/types";
import { requirePlatformSession, requireRole, requireShopSession } from "@/lib/auth/session";
import { isUniqueViolation } from "@/lib/customers/resolve";
import { notifyTicketStatusChanged } from "@/lib/notifications/actions";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTempPassword } from "@/lib/tenant-onboarding";
import type { FeatureKey, Package, SupportTicket, Tenant } from "@/lib/types";

import {
  BILLING_TO_PRISMA,
  FEATURE_TO_PRISMA,
  PRIORITY_TO_PRISMA,
  tenantDto,
  TICKET_STATUS_TO_PRISMA,
} from "./dto";
import { tenantByIdDto } from "./queries";

/**
 * Super Admin's writes. `createTenant` is the one exception to "platform
 * session required": it is also how `/pricing` signs a prospect up, so it
 * authorises on nothing but the input itself, the same way `bookAppointment`
 * and `joinQueue` do for customers.
 */

const MAX_PRICE = 100_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_PRICE;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A Super Admin may act on any tenant; an owner may act on their own —
 * used by the two self-service writes a tenant's own billing page makes
 * (upgrading its plan, converting its trial). Everything else here stays
 * `requirePlatformSession()` only.
 */
async function requirePlatformOrOwnTenant(tenantId: string): Promise<void> {
  try {
    await requirePlatformSession();
    return;
  } catch {
    // Fall through to the owner check below.
  }
  const { staff } = await requireRole("OWNER");
  if (staff.tenantId !== tenantId) {
    throw new Error("Unauthorized: not this tenant's owner");
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "shop"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await prisma.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function mrrFor(
  pkg: { price: unknown; yearlyPrice: unknown },
  billing: "MONTHLY" | "YEARLY",
  status: "ACTIVE" | "TRIAL" | "SUSPENDED",
): number {
  if (status !== "ACTIVE") return 0;
  return billing === "YEARLY"
    ? round2(Number(pkg.yearlyPrice) / 12)
    : round2(Number(pkg.price));
}

// ---- Tenants --------------------------------------------------------------

/**
 * Create a tenant, its default settings, and a real login for its owner.
 * Public by design — a prospect on /pricing calls this directly, and Super
 * Admin's "Add Tenant" calls it too.
 */
export async function createTenant(input: {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  packageId: string;
  billing?: "monthly" | "yearly";
  startAs?: "trial" | "active";
}): Promise<ActionResult<{ tenant: Tenant; tempPassword: string }>> {
  const businessName = clean(input.businessName, 120);
  const ownerName = clean(input.ownerName, 120);
  const ownerEmail = clean(input.ownerEmail, 200).toLowerCase();
  if (!businessName) return { ok: false, error: "Business name is required" };
  if (!ownerName) return { ok: false, error: "Owner name is required" };
  if (!EMAIL_RE.test(ownerEmail)) return { ok: false, error: "Check the owner's email" };

  const pkg = await prisma.package.findFirst({
    where: { id: input.packageId, active: true },
  });
  if (!pkg) return { ok: false, error: "Pick a plan" };

  const takenEmail = await prisma.staff.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (takenEmail) return { ok: false, error: "Someone already uses this email" };

  const billing = BILLING_TO_PRISMA[input.billing ?? "monthly"];
  const status = input.startAs === "active" ? "ACTIVE" : "TRIAL";
  const trialEndsAt =
    status === "TRIAL" ? new Date(Date.now() + pkg.trialDays * 86_400_000) : null;
  const mrr = mrrFor(pkg, billing, status);
  const slug = await uniqueSlug(businessName);

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: tempPassword,
    // The owner's address is taken on trust here, same as a staff invite —
    // there is no inbox to click through at sign-up time.
    email_confirm: true,
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Could not create the owner's login" };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug,
          packageId: pkg.id,
          status,
          billing,
          mrr,
          ownerName,
          ownerEmail,
          trialEndsAt,
        },
        include: { package: { select: { name: true } } },
      });
      await tx.tenantSettings.create({ data: { tenantId: tenant.id } });
      const owner = await tx.staff.create({
        data: {
          tenantId: tenant.id,
          branchId: null,
          name: ownerName,
          email: ownerEmail,
          role: "OWNER",
          authUserId: data.user!.id,
          mustChangePassword: true,
        },
        select: { email: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
      });
      return { tenant, owner };
    });

    revalidatePath("/super-admin/tenant");
    revalidatePath("/super-admin/dashboard");
    return {
      ok: true,
      data: {
        tenant: tenantDto(
          created.tenant,
          { branches: 0, staff: 1 },
          created.owner,
        ),
        tempPassword,
      },
    };
  } catch (cause) {
    await admin.auth.admin.deleteUser(data.user.id);
    if (isUniqueViolation(cause)) {
      return { ok: false, error: "That business name or owner email is already in use" };
    }
    throw cause;
  }
}

/** Every mutator below hands back the freshly computed tenant, so the client
 * never re-derives status/mrr/trial logic itself — it just replaces its copy. */
async function tenantResult(tenantId: string): Promise<ActionResult<{ tenant: Tenant }>> {
  const tenant = await tenantByIdDto(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found" };
  revalidatePath("/super-admin/tenant");
  return { ok: true, data: { tenant } };
}

export async function updateTenant(
  tenantId: string,
  patch: Partial<Pick<Tenant, "name" | "ownerName" | "ownerEmail">>,
): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformSession();

  const data: { name?: string; ownerName?: string; ownerEmail?: string } = {};
  if (patch.name !== undefined) {
    data.name = clean(patch.name, 120);
    if (!data.name) return { ok: false, error: "Business name is required" };
  }
  if (patch.ownerName !== undefined) {
    data.ownerName = clean(patch.ownerName, 120);
    if (!data.ownerName) return { ok: false, error: "Owner name is required" };
  }
  let email: string | undefined;
  if (patch.ownerEmail !== undefined) {
    email = clean(patch.ownerEmail, 200).toLowerCase();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Check the owner's email" };
    data.ownerEmail = email;
  }

  try {
    const updated = await prisma.tenant.updateMany({ where: { id: tenantId }, data });
    if (updated.count === 0) return { ok: false, error: "Tenant not found" };

    // The owner signs in with this address, so the login and the record
    // shown here never drift apart.
    if (email) {
      const owner = await prisma.staff.findFirst({
        where: { tenantId, role: "OWNER" },
        select: { id: true, authUserId: true },
      });
      if (owner?.authUserId) {
        const admin = createAdminClient();
        const { error } = await admin.auth.admin.updateUserById(owner.authUserId, { email });
        if (error) return { ok: false, error: error.message };
        await prisma.staff.update({ where: { id: owner.id }, data: { email } });
      }
    }

    return tenantResult(tenantId);
  } catch (cause) {
    if (isUniqueViolation(cause)) return { ok: false, error: "That name or email is already in use" };
    throw cause;
  }
}

/** New temporary password for the owner; shown once, never stored. */
export async function resetOwnerPassword(
  tenantId: string,
): Promise<ActionResult<{ tenant: Tenant; tempPassword: string }>> {
  await requirePlatformSession();

  const owner = await prisma.staff.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { id: true, authUserId: true },
  });
  if (!owner?.authUserId) return { ok: false, error: "Owner account not found" };

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(owner.authUserId, {
    password: tempPassword,
  });
  if (error) return { ok: false, error: error.message };

  await prisma.staff.update({
    where: { id: owner.id },
    data: { mustChangePassword: true },
  });

  const tenant = await tenantByIdDto(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found" };
  revalidatePath("/super-admin/tenant");
  return { ok: true, data: { tenant, tempPassword } };
}

export async function changeTenantPlan(
  tenantId: string,
  packageId: string,
  billing?: "monthly" | "yearly",
): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformOrOwnTenant(tenantId);

  const pkg = await prisma.package.findFirst({ where: { id: packageId, active: true } });
  if (!pkg) return { ok: false, error: "Plan not found" };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, billing: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found" };

  const nextBilling = billing ? BILLING_TO_PRISMA[billing] : tenant.billing;
  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: {
      packageId: pkg.id,
      billing: nextBilling,
      mrr: mrrFor(pkg, nextBilling, tenant.status),
    },
  });
  if (updated.count === 0) return { ok: false, error: "Tenant not found" };

  return tenantResult(tenantId);
}

export async function convertTrialToActive(
  tenantId: string,
): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformOrOwnTenant(tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { package: { select: { price: true, yearlyPrice: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found" };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: "ACTIVE",
      trialEndsAt: null,
      mrr: mrrFor(tenant.package, tenant.billing, "ACTIVE"),
    },
  });

  return tenantResult(tenantId);
}

export async function suspendTenant(tenantId: string): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformSession();
  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: { status: "SUSPENDED", mrr: 0 },
  });
  if (updated.count === 0) return { ok: false, error: "Tenant not found" };
  return tenantResult(tenantId);
}

/**
 * Lifting a suspension puts a tenant back where it was: a trial that has not
 * run out resumes as a trial, anything else is a paying subscription — this
 * must never turn a trial into a free paid plan.
 */
export async function activateTenant(tenantId: string): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformSession();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { package: { select: { price: true, yearlyPrice: true } } },
  });
  if (!tenant) return { ok: false, error: "Tenant not found" };

  const resumeTrial = !!tenant.trialEndsAt && tenant.trialEndsAt.getTime() >= Date.now();
  const status = resumeTrial ? "TRIAL" : "ACTIVE";
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status,
      trialEndsAt: resumeTrial ? tenant.trialEndsAt : null,
      mrr: mrrFor(tenant.package, tenant.billing, status),
    },
  });

  return tenantResult(tenantId);
}

export async function archiveTenant(tenantId: string): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformSession();
  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: { status: "SUSPENDED", mrr: 0, archived: true, archivedAt: new Date() },
  });
  if (updated.count === 0) return { ok: false, error: "Tenant not found" };
  return tenantResult(tenantId);
}

export async function restoreTenant(tenantId: string): Promise<ActionResult<{ tenant: Tenant }>> {
  await requirePlatformSession();
  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: { archived: false, archivedAt: null },
  });
  if (updated.count === 0) return { ok: false, error: "Tenant not found" };
  return tenantResult(tenantId);
}

// ---- Packages ---------------------------------------------------------------

const DEFAULT_FEATURES: FeatureKey[] = ["queue", "booking", "pos"];

export async function addPackage(
  input: Omit<Package, "id">,
): Promise<ActionResult<{ id: string }>> {
  await requirePlatformSession();

  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "Plan name is required" };
  if (!money(input.price) || !money(input.yearlyPrice)) return { ok: false, error: "Check the price" };
  if (!Number.isInteger(input.maxBranches) || input.maxBranches < 1) {
    return { ok: false, error: "Check the branch limit" };
  }
  if (!Number.isInteger(input.maxStaff) || input.maxStaff < 1) {
    return { ok: false, error: "Check the staff limit" };
  }

  const slug = await (async () => {
    const base = slugify(name);
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await prisma.package.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  })();

  const created = await prisma.package.create({
    data: {
      name,
      slug,
      price: round2(input.price),
      yearlyPrice: round2(input.yearlyPrice),
      features: (input.features ?? []).map((f) => clean(f, 120)).filter(Boolean).slice(0, 20),
      popular: !!input.popular,
      maxBranches: input.maxBranches,
      maxStaff: input.maxStaff,
      trialDays: Number.isInteger(input.trialDays) && input.trialDays >= 0 ? input.trialDays : 14,
    },
    select: { id: true },
  });
  await prisma.packageFeature.createMany({
    data: (["queue", "booking", "pos", "commission", "inventory", "membership", "analytics", "api", "white-label"] as FeatureKey[]).map(
      (key) => ({
        packageId: created.id,
        feature: FEATURE_TO_PRISMA[key],
        enabled: DEFAULT_FEATURES.includes(key),
      }),
    ),
  });

  revalidatePath("/super-admin/packages");
  revalidatePath("/pricing");
  return { ok: true, data: { id: created.id } };
}

export async function updatePackage(
  packageId: string,
  patch: Partial<Omit<Package, "id">>,
): Promise<ActionResult> {
  await requirePlatformSession();

  const data: {
    name?: string;
    price?: number;
    yearlyPrice?: number;
    features?: string[];
    popular?: boolean;
    maxBranches?: number;
    maxStaff?: number;
    trialDays?: number;
    active?: boolean;
  } = {};
  if (patch.name !== undefined) {
    data.name = clean(patch.name, 80);
    if (!data.name) return { ok: false, error: "Plan name is required" };
  }
  if (patch.price !== undefined) {
    if (!money(patch.price)) return { ok: false, error: "Check the price" };
    data.price = round2(patch.price);
  }
  if (patch.yearlyPrice !== undefined) {
    if (!money(patch.yearlyPrice)) return { ok: false, error: "Check the yearly price" };
    data.yearlyPrice = round2(patch.yearlyPrice);
  }
  if (patch.features !== undefined) {
    data.features = patch.features.map((f) => clean(f, 120)).filter(Boolean).slice(0, 20);
  }
  if (patch.popular !== undefined) data.popular = !!patch.popular;
  if (patch.maxBranches !== undefined) {
    if (!Number.isInteger(patch.maxBranches) || patch.maxBranches < 1) {
      return { ok: false, error: "Check the branch limit" };
    }
    data.maxBranches = patch.maxBranches;
  }
  if (patch.maxStaff !== undefined) {
    if (!Number.isInteger(patch.maxStaff) || patch.maxStaff < 1) {
      return { ok: false, error: "Check the staff limit" };
    }
    data.maxStaff = patch.maxStaff;
  }
  if (patch.trialDays !== undefined) {
    if (!Number.isInteger(patch.trialDays) || patch.trialDays < 0) {
      return { ok: false, error: "Check the trial length" };
    }
    data.trialDays = patch.trialDays;
  }

  // Price/name changes do not retroactively change what a subscribed tenant
  // is already being billed — `mrr` stays what it was contracted at.
  const updated = await prisma.package.updateMany({ where: { id: packageId }, data });
  if (updated.count === 0) return { ok: false, error: "Plan not found" };

  revalidatePath("/super-admin/packages");
  revalidatePath("/pricing");
  return { ok: true };
}

// ---- Feature matrix -----------------------------------------------------------

export async function toggleFeature(packageId: string, feature: FeatureKey): Promise<ActionResult> {
  await requirePlatformSession();

  const prismaFeature = FEATURE_TO_PRISMA[feature];
  const existing = await prisma.packageFeature.findUnique({
    where: { packageId_feature: { packageId, feature: prismaFeature } },
    select: { enabled: true },
  });
  await prisma.packageFeature.upsert({
    where: { packageId_feature: { packageId, feature: prismaFeature } },
    create: { packageId, feature: prismaFeature, enabled: true },
    update: { enabled: !existing?.enabled },
  });

  revalidatePath("/super-admin/features");
  return { ok: true };
}

/** Bulk-replace the whole matrix — e.g. restoring a saved default. */
export async function setFeatureMatrix(
  matrix: Record<string, Record<FeatureKey, boolean>>,
): Promise<ActionResult> {
  await requirePlatformSession();

  const writes = Object.entries(matrix).flatMap(([packageId, row]) =>
    (Object.entries(row) as [FeatureKey, boolean][]).map(([feature, enabled]) =>
      prisma.packageFeature.upsert({
        where: { packageId_feature: { packageId, feature: FEATURE_TO_PRISMA[feature] } },
        create: { packageId, feature: FEATURE_TO_PRISMA[feature], enabled },
        update: { enabled },
      }),
    ),
  );
  await prisma.$transaction(writes);

  revalidatePath("/super-admin/features");
  return { ok: true };
}

// ---- Support tickets ----------------------------------------------------------

export async function addSupportTicket(input: {
  tenantId: string;
  subject: string;
  priority: SupportTicket["priority"];
}): Promise<ActionResult<{ id: string }>> {
  await requirePlatformSession();

  const subject = clean(input.subject, 200);
  if (!subject) return { ok: false, error: "Subject is required" };
  const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Tenant not found" };

  const created = await prisma.supportTicket.create({
    data: {
      tenantId: input.tenantId,
      subject,
      priority: PRIORITY_TO_PRISMA[input.priority],
    },
    select: { id: true },
  });

  revalidatePath("/super-admin/support");
  return { ok: true, data: { id: created.id } };
}

export async function updateTicket(
  ticketId: string,
  patch: Partial<Pick<SupportTicket, "status" | "priority">>,
): Promise<ActionResult> {
  await requirePlatformSession();

  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { tenantId: true, subject: true },
  });
  if (!existing) return { ok: false, error: "Ticket not found" };

  const data: {
    status?: TicketStatus;
    priority?: TicketPriority;
    resolvedAt?: Date | null;
  } = {};
  if (patch.status !== undefined) {
    data.status = TICKET_STATUS_TO_PRISMA[patch.status];
    data.resolvedAt = patch.status === "resolved" ? new Date() : null;
  }
  if (patch.priority !== undefined) data.priority = PRIORITY_TO_PRISMA[patch.priority];

  await prisma.supportTicket.update({ where: { id: ticketId }, data });

  if (patch.status !== undefined) {
    await notifyTicketStatusChanged({
      tenantId: existing.tenantId,
      subject: existing.subject,
      status: patch.status,
    });
  }

  revalidatePath("/super-admin/support");
  return { ok: true };
}

/** A tenant raising its own ticket — any shop role, never picks the tenant. */
export async function raiseSupportTicket(input: {
  subject: string;
  priority: SupportTicket["priority"];
}): Promise<ActionResult<{ id: string }>> {
  const { staff } = await requireShopSession();

  const subject = clean(input.subject, 200);
  if (!subject) return { ok: false, error: "Subject is required" };

  const created = await prisma.supportTicket.create({
    data: {
      tenantId: staff.tenantId,
      subject,
      priority: PRIORITY_TO_PRISMA[input.priority],
    },
    select: { id: true },
  });

  revalidatePath("/owner/support");
  return { ok: true, data: { id: created.id } };
}
