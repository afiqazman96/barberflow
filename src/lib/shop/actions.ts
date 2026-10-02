"use server";

import type { ShiftActor, Staff } from "@/generated/prisma/client";
import { requireRole, requireShopSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { timezoneForTenant } from "@/lib/bookings/queries";
import { isUniqueViolation } from "@/lib/customers/resolve";
import { prisma } from "@/lib/prisma";
import type { OpsRules } from "@/lib/types";

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
