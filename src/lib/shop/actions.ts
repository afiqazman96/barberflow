"use server";

import type { ShiftActor, Staff } from "@/generated/prisma/client";
import type { CommissionScope, CommissionType } from "@/generated/prisma/enums";
import { requireRole, requireShopSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { timezoneForTenant } from "@/lib/bookings/queries";
import { isUniqueViolation } from "@/lib/customers/resolve";
import { prisma } from "@/lib/prisma";
import type { CommissionRule, OpsRules, TaxConfig } from "@/lib/types";

import type { RosterDayInput } from "./dto";
import { dateColumn, shopToday } from "./queries";

/**
 * Every write to shifts, the roster, leave and the shop's rules. Triggers on
 * those tables poke each affected branch, so nothing here publishes.
 */

type ShiftTarget = Pick<
  Staff,
  "id" | "tenantId" | "branchId" | "role" | "active" | "chairId" | "name"
>;

const targetSelect = {
  id: true,
  tenantId: true,
  branchId: true,
  role: true,
  active: true,
  chairId: true,
  name: true,
} as const;

async function findTarget(staffId: string, tenantId: string) {
  return prisma.staff.findFirst({ where: { id: staffId, tenantId }, select: targetSelect });
}

/**
 * Open a shift: on duty, at a chair if they are a barber. Clocking in when a
 * shift is already open is not an error — it puts them back on duty, which
 * is what a second device or a double tap means.
 */
async function startShiftFor(
  target: ShiftTarget,
  opts: { chairId?: string | null; by: ShiftActor; note?: string },
): Promise<ActionResult> {
  if (!target.active) return { ok: false, error: "This account is disabled" };
  if (target.role === "OWNER") return { ok: false, error: "Owners do not clock in" };
  if (!target.branchId) return { ok: false, error: "Assign a branch first" };

  let chairId: string | null = null;
  if (target.role === "BARBER") {
    chairId = opts.chairId ?? target.chairId ?? null;
    if (chairId) {
      const chair = await prisma.chair.findFirst({
        where: { id: chairId, branchId: target.branchId },
        select: { id: true, label: true },
      });
      if (!chair) return { ok: false, error: "Pick a chair at your own branch" };
      const holder = await prisma.staff.findFirst({
        where: { chairId, id: { not: target.id } },
        select: { id: true },
      });
      if (holder) return { ok: false, error: `${chair.label} is already taken` };
    }
  }

  const onDuty = { status: "AVAILABLE" as const, ...(chairId ? { chairId } : {}) };
  const open = await prisma.shift.findFirst({
    where: { staffId: target.id, endedAt: null },
    select: { id: true },
  });
  if (open) {
    await prisma.staff.update({ where: { id: target.id }, data: onDuty });
    return { ok: true };
  }

  const timeZone = await timezoneForTenant(target.tenantId);
  try {
    await prisma.$transaction([
      prisma.shift.create({
        data: {
          tenantId: target.tenantId,
          branchId: target.branchId,
          staffId: target.id,
          date: dateColumn(shopToday(timeZone)),
          startedAt: new Date(),
          chairId,
          startedBy: opts.by,
          note: opts.note?.trim() || null,
        },
      }),
      prisma.staff.update({ where: { id: target.id }, data: onDuty }),
    ]);
  } catch (error) {
    // Another device opened it a moment ago (`shifts_one_open_per_staff`).
    if (!isUniqueViolation(error)) throw error;
    await prisma.staff.update({ where: { id: target.id }, data: onDuty });
  }
  return { ok: true };
}

/**
 * Close the open shift: off duty, chair freed, and customers who asked for
 * this person become "Any Barber". Not while they are mid-service.
 */
async function endShiftFor(
  target: ShiftTarget,
  opts: { by: ShiftActor; note?: string },
): Promise<ActionResult> {
  const serving = await prisma.queueTicket.count({
    where: { assignedStaffId: target.id, status: "IN_SERVICE" },
  });
  if (serving > 0) return { ok: false, error: "Finish the current service first" };
  const till = await prisma.drawerSession.count({
    where: { cashierId: target.id, closedAt: null },
  });
  if (till > 0) return { ok: false, error: "Close the cash drawer first" };

  await prisma.$transaction([
    prisma.shift.updateMany({
      where: { staffId: target.id, endedAt: null },
      data: {
        endedAt: new Date(),
        endedBy: opts.by,
        ...(opts.note?.trim() ? { note: opts.note.trim() } : {}),
      },
    }),
    prisma.staff.update({
      where: { id: target.id },
      data: { status: "OFF_DUTY", chairId: null },
    }),
    prisma.queueTicket.updateMany({
      where: {
        tenantId: target.tenantId,
        preferredStaffId: target.id,
        status: { in: ["WAITING", "CALLED"] },
      },
      data: { preferredStaffId: null },
    }),
  ]);
  return { ok: true };
}

/** The signed-in barber or cashier starts their own shift. */
export async function clockIn(chairId?: string | null): Promise<ActionResult> {
  const { staff } = await requireShopSession();
  return startShiftFor(staff, { chairId, by: "SELF" });
}

/** The signed-in barber or cashier ends their own shift. */
export async function clockOut(): Promise<ActionResult> {
  const { staff } = await requireShopSession();
  if (staff.role === "OWNER") return { ok: false, error: "Owners do not clock in" };
  return endShiftFor(staff, { by: "SELF" });
}

/** The owner clocks someone in for them (forgot, phone flat, ...). */
export async function ownerClockIn(
  staffId: string,
  opts: { chairId?: string | null; note?: string },
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const target = await findTarget(staffId, owner.tenantId);
  if (!target) return { ok: false, error: "Staff member not found" };
  return startShiftFor(target, { ...opts, by: "OWNER" });
}

/** The owner clocks someone out for them. */
export async function ownerClockOut(
  staffId: string,
  note?: string,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const target = await findTarget(staffId, owner.tenantId);
  if (!target) return { ok: false, error: "Staff member not found" };
  return endShiftFor(target, { by: "OWNER", note });
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Set one weekday of someone's weekly roster. */
export async function saveRosterDay(
  staffId: string,
  weekday: number,
  day: RosterDayInput,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "Unknown day" };
  }
  if (!HHMM.test(day.start) || !HHMM.test(day.end)) {
    return { ok: false, error: "Times must be HH:MM" };
  }
  if (!day.off && day.start >= day.end) {
    return { ok: false, error: "The shift must end after it starts" };
  }
  const target = await findTarget(staffId, owner.tenantId);
  if (!target) return { ok: false, error: "Staff member not found" };

  const data = { off: !!day.off, start: day.start, end: day.end };
  await prisma.rosterDay.upsert({
    where: { staffId_weekday: { staffId, weekday } },
    create: { tenantId: owner.tenantId, staffId, weekday, ...data },
    update: data,
  });
  return { ok: true };
}

/** Record a day away. One entry per person per day; a second replaces it. */
export async function saveLeave(input: {
  staffId: string;
  date: string;
  reason: string;
}): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Pick a date" };
  }
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Give a reason" };
  const target = await findTarget(input.staffId, owner.tenantId);
  if (!target) return { ok: false, error: "Staff member not found" };

  const date = dateColumn(input.date);
  await prisma.staffLeave.upsert({
    where: { staffId_date: { staffId: target.id, date } },
    create: { tenantId: owner.tenantId, staffId: target.id, date, reason },
    update: { reason },
  });
  return { ok: true };
}

/** Remove a day away, by person and date — ids made in a browser never reach here. */
export async function deleteLeave(staffId: string, date: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a date" };
  await prisma.staffLeave.deleteMany({
    where: { tenantId: owner.tenantId, staffId, date: dateColumn(date) },
  });
  return { ok: true };
}

const LIMITS: Record<keyof OpsRules, [number, number]> = {
  gracePeriodMins: [0, 120],
  maxWaitMins: [5, 600],
  advanceDays: [1, 90],
  cancelHours: [0, 168],
  slotInterval: [5, 120],
};

/** The owner changes how the shop runs bookings and the queue. */
export async function saveOpsRules(rules: OpsRules): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  for (const [key, [min, max]] of Object.entries(LIMITS) as [keyof OpsRules, [number, number]][]) {
    const value = rules[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      return { ok: false, error: `${key} must be a whole number from ${min} to ${max}` };
    }
  }

  const data = {
    defaultGracePeriodMins: rules.gracePeriodMins,
    maxWaitMins: rules.maxWaitMins,
    advanceDays: rules.advanceDays,
    cancelHours: rules.cancelHours,
    slotInterval: rules.slotInterval,
  };
  await prisma.tenantSettings.upsert({
    where: { tenantId: owner.tenantId },
    create: { tenantId: owner.tenantId, ...data },
    update: data,
  });
  return { ok: true };
}

/** The owner sets the service charge and SST every bill is worked out with. */
export async function saveTaxConfig(config: TaxConfig): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const rate = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
  if (!rate(config.serviceChargeRate) || !rate(config.sstRate)) {
    return { ok: false, error: "Rates must be from 0 to 100%" };
  }
  if (config.applyTo !== "services" && config.applyTo !== "all") {
    return { ok: false, error: "Unknown charge base" };
  }

  const data = {
    serviceChargeEnabled: !!config.serviceChargeEnabled,
    serviceChargeRate: Math.round(config.serviceChargeRate * 100) / 100,
    sstEnabled: !!config.sstEnabled,
    sstRate: Math.round(config.sstRate * 100) / 100,
    sstRegNo: String(config.sstRegNo ?? "").trim().slice(0, 60),
    taxAppliesTo: config.applyTo,
  };
  await prisma.tenantSettings.upsert({
    where: { tenantId: owner.tenantId },
    create: { tenantId: owner.tenantId, ...data },
    update: data,
  });
  return { ok: true };
}

const RULE_TYPE_TO_PRISMA = {
  fixed: "FIXED",
  percentage: "PERCENTAGE",
  "service-based": "SERVICE_BASED",
  "product-based": "PRODUCT_BASED",
} as const satisfies Record<CommissionRule["type"], CommissionType>;

const RULE_SCOPE_TO_PRISMA = {
  all: "ALL",
  service: "SERVICE",
  product: "PRODUCT",
} as const satisfies Record<CommissionRule["appliesTo"], CommissionScope>;

/** The owner adds a commission rule. Returns its id, so the screen can keep it. */
export async function createCommissionRule(
  input: Omit<CommissionRule, "id">,
): Promise<ActionResult<{ id: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const name = input.name?.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Rule name is required" };
  const type = RULE_TYPE_TO_PRISMA[input.type];
  const appliesTo = RULE_SCOPE_TO_PRISMA[input.appliesTo];
  if (!type || !appliesTo) return { ok: false, error: "Unknown rule type" };
  // A share of the sale can't be more than the sale; a flat bonus has no cap.
  const max = input.type === "fixed" ? 10_000 : 100;
  if (!Number.isFinite(input.value) || input.value < 0 || input.value > max) {
    return { ok: false, error: `Value must be from 0 to ${max}` };
  }

  // Whatever the rule points at must be this shop's own.
  const [service, product, staff] = await Promise.all([
    input.serviceId
      ? prisma.service.findFirst({ where: { id: input.serviceId, tenantId: owner.tenantId } })
      : null,
    input.productId
      ? prisma.product.findFirst({ where: { id: input.productId, tenantId: owner.tenantId } })
      : null,
    input.staffId
      ? prisma.staff.findFirst({ where: { id: input.staffId, tenantId: owner.tenantId } })
      : null,
  ]);
  if ((input.serviceId && !service) || (input.productId && !product) || (input.staffId && !staff)) {
    return { ok: false, error: "That service, product or barber isn't in this shop" };
  }

  const rule = await prisma.commissionRule.create({
    data: {
      tenantId: owner.tenantId,
      name,
      type,
      value: Math.round(input.value * 100) / 100,
      appliesTo,
      serviceId: service?.id ?? null,
      productId: product?.id ?? null,
      staffId: staff?.id ?? null,
      active: input.active !== false,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: rule.id } };
}

/** The owner switches a commission rule on or off. */
export async function setCommissionRuleActive(
  ruleId: string,
  active: boolean,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const updated = await prisma.commissionRule.updateMany({
    where: { id: ruleId, tenantId: owner.tenantId },
    data: { active: !!active },
  });
  if (updated.count === 0) return { ok: false, error: "Rule not found" };
  return { ok: true };
}

const LOGO_DATA_URL = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;

/**
 * The owner's business details, as printed on every receipt. The logo is a
 * data URL from the upload control, our own `/api/catalog/image/logo/...`
 * link when unchanged, or null when removed.
 */
export async function saveBusinessProfile(input: {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  logoUrl?: string | null;
}): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const name = String(input.name ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Business name is required" };
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Check the email address" };
  }

  let logoUrl: string | null | undefined;
  if (input.logoUrl === undefined || input.logoUrl?.startsWith("/api/catalog/image/")) {
    logoUrl = undefined;
  } else if (!input.logoUrl) {
    logoUrl = null;
  } else if (input.logoUrl.length <= 1_000_000 && LOGO_DATA_URL.test(input.logoUrl)) {
    logoUrl = input.logoUrl;
  } else if (/^https:\/\/\S+$/i.test(input.logoUrl) && input.logoUrl.length <= 2000) {
    logoUrl = input.logoUrl;
  } else {
    return { ok: false, error: "That logo can't be used" };
  }

  const data = {
    phone: String(input.phone ?? "").trim().slice(0, 40) || null,
    email: email || null,
    address: String(input.address ?? "").trim().slice(0, 300) || null,
    taxId: String(input.taxId ?? "").trim().slice(0, 60) || null,
    ...(logoUrl !== undefined ? { logoUrl } : {}),
  };
  await prisma.$transaction([
    prisma.tenant.update({ where: { id: owner.tenantId }, data: { name } }),
    prisma.tenantSettings.upsert({
      where: { tenantId: owner.tenantId },
      create: { tenantId: owner.tenantId, ...data },
      update: data,
    }),
  ]);
  return { ok: true };
}
