import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CommissionScope, CommissionType, ShiftActor } from "@/generated/prisma/enums";
import { requireShopSession } from "@/lib/auth/session";
import { timezoneForTenant } from "@/lib/bookings/queries";
import { instantToShopTime } from "@/lib/bookings/time";
import { DEFAULT_TAX_CONFIG } from "@/lib/pos-pricing";
import { prisma } from "@/lib/prisma";
import type {
  CommissionRule,
  LeaveEntry,
  OpsRules,
  RosterDay,
  ShiftRecord,
  TaxConfig,
} from "@/lib/types";

import type { ShopSnapshot } from "./dto";
import { closeStaleShifts } from "./housekeeping";

/** How far back staff screens see shifts and leave (attendance, history). */
const HISTORY_DAYS = 62;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The defaults `tenant_settings` has, for a shop without a settings row. */
export const DEFAULT_OPS_RULES: OpsRules = {
  gracePeriodMins: 10,
  maxWaitMins: 45,
  advanceDays: 7,
  cancelHours: 4,
  slotInterval: 30,
};

/** The shop's calendar date right now, `YYYY-MM-DD`. */
export function shopToday(timeZone: string, now: Date = new Date()): string {
  return instantToShopTime(now, timeZone).date;
}

/** A `YYYY-MM-DD` as a `@db.Date` value (midnight UTC), and back. */
export const dateColumn = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const isoOf = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return isoOf(new Date(dateColumn(iso).getTime() + days * DAY_MS));
}

export async function opsRulesFor(tenantId: string): Promise<OpsRules> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: {
      defaultGracePeriodMins: true,
      maxWaitMins: true,
      advanceDays: true,
      cancelHours: true,
      slotInterval: true,
    },
  });
  if (!settings) return DEFAULT_OPS_RULES;
  return {
    gracePeriodMins: settings.defaultGracePeriodMins,
    maxWaitMins: settings.maxWaitMins,
    advanceDays: settings.advanceDays,
    cancelHours: settings.cancelHours,
    slotInterval: settings.slotInterval,
  };
}

/** The shop's service charge and SST; everything off for a shop without settings. */
export async function taxConfigFor(tenantId: string): Promise<TaxConfig> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: {
      serviceChargeEnabled: true,
      serviceChargeRate: true,
      sstEnabled: true,
      sstRate: true,
      sstRegNo: true,
      taxAppliesTo: true,
    },
  });
  if (!settings) return { ...DEFAULT_TAX_CONFIG };
  return {
    serviceChargeEnabled: settings.serviceChargeEnabled,
    serviceChargeRate: Number(settings.serviceChargeRate),
    sstEnabled: settings.sstEnabled,
    sstRate: Number(settings.sstRate),
    sstRegNo: settings.sstRegNo,
    applyTo: settings.taxAppliesTo === "all" ? "all" : "services",
  };
}

const RULE_TYPE = {
  FIXED: "fixed",
  PERCENTAGE: "percentage",
  SERVICE_BASED: "service-based",
  PRODUCT_BASED: "product-based",
} as const satisfies Record<CommissionType, CommissionRule["type"]>;

const RULE_SCOPE = {
  ALL: "all",
  SERVICE: "service",
  PRODUCT: "product",
} as const satisfies Record<CommissionScope, CommissionRule["appliesTo"]>;

/** Every commission rule, on or off — the owner's screen lists both. */
export async function commissionRulesFor(tenantId: string): Promise<CommissionRule[]> {
  const rows = await prisma.commissionRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: RULE_TYPE[r.type],
    value: Number(r.value),
    appliesTo: RULE_SCOPE[r.appliesTo],
    serviceId: r.serviceId ?? undefined,
    productId: r.productId ?? undefined,
    staffId: r.staffId ?? undefined,
    active: r.active,
  }));
}

const ACTOR: Record<ShiftActor, "self" | "owner" | "auto"> = {
  SELF: "self",
  OWNER: "owner",
  AUTO: "auto",
};

export const shiftSelect = {
  id: true,
  staffId: true,
  branchId: true,
  date: true,
  startedAt: true,
  endedAt: true,
  chairId: true,
  startedBy: true,
  endedBy: true,
  note: true,
} satisfies Prisma.ShiftSelect;

type ShiftRow = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>;

export function toShiftDto(row: ShiftRow): ShiftRecord {
  return {
    id: row.id,
    staffId: row.staffId,
    branchId: row.branchId,
    date: isoOf(row.date),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString(),
    chairId: row.chairId,
    // A shift is only ever opened by the person or the owner.
    startedBy: row.startedBy === "OWNER" ? "owner" : "self",
    endedBy: row.endedBy ? ACTOR[row.endedBy] : undefined,
    note: row.note ?? undefined,
  };
}

/**
 * Roster rows as the store's `Record<staffId, RosterDay[7]>`. Someone with
 * any row gets a full week (missing days read as rest days); someone with
 * none is left out, which the screens show as "no roster set".
 */
function toRoster(
  rows: { staffId: string; weekday: number; off: boolean; start: string; end: string }[],
): Record<string, RosterDay[]> {
  const roster: Record<string, RosterDay[]> = {};
  for (const row of rows) {
    if (row.weekday < 0 || row.weekday > 6) continue;
    roster[row.staffId] ??= Array.from({ length: 7 }, () => ({
      off: true,
      start: "10:00",
      end: "19:00",
    }));
    roster[row.staffId][row.weekday] = { off: row.off, start: row.start, end: row.end };
  }
  return roster;
}

async function staffChairsAt(branchIds: string[]) {
  const rows = await prisma.staff.findMany({
    where: { branchId: { in: branchIds }, active: true, role: { not: "OWNER" } },
    select: { id: true, chairId: true },
  });
  return {
    ids: rows.map((r) => r.id),
    chairs: Object.fromEntries(rows.map((r) => [r.id, r.chairId])),
  };
}

/**
 * The shop's set-up for the signed-in staff member: rules, the team's roster
 * and leave, recent shifts, and chairs. Owners get every branch, everyone
 * else their own. Stale shifts are closed out first (`housekeeping.ts`).
 */
export async function staffShopSnapshot(): Promise<ShopSnapshot> {
  const { staff } = await requireShopSession();

  const branchIds = staff.branchId
    ? [staff.branchId]
    : (
        await prisma.branch.findMany({
          where: { tenantId: staff.tenantId },
          select: { id: true },
        })
      ).map((b) => b.id);

  const timeZone = await timezoneForTenant(staff.tenantId);
  await closeStaleShifts(staff.tenantId, timeZone);

  const since = dateColumn(addDays(shopToday(timeZone), -HISTORY_DAYS));
  const { ids, chairs } = await staffChairsAt(branchIds);

  const [opsRules, taxConfig, commissionRules, rosterRows, leaveRows, shiftRows] = await Promise.all([
    opsRulesFor(staff.tenantId),
    taxConfigFor(staff.tenantId),
    commissionRulesFor(staff.tenantId),
    prisma.rosterDay.findMany({
      where: { tenantId: staff.tenantId, staffId: { in: ids } },
      select: { staffId: true, weekday: true, off: true, start: true, end: true },
    }),
    prisma.staffLeave.findMany({
      where: { tenantId: staff.tenantId, staffId: { in: ids }, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { id: true, staffId: true, date: true, reason: true },
    }),
    prisma.shift.findMany({
      where: { tenantId: staff.tenantId, branchId: { in: branchIds }, date: { gte: since } },
      orderBy: { startedAt: "desc" },
      select: shiftSelect,
    }),
  ]);

  return {
    opsRules,
    roster: toRoster(rosterRows),
    leaves: leaveRows.map(
      (l): LeaveEntry => ({ id: l.id, staffId: l.staffId, date: isoOf(l.date), reason: l.reason }),
    ),
    shifts: shiftRows.map(toShiftDto),
    staffChairs: chairs,
    branchIds,
    taxConfig,
    commissionRules,
  };
}

/**
 * What a customer's screens need to know about one branch: its rules, when
 * each barber works, the days they are away, and where they sit — so the
 * booking form offers only real slots. No shifts, and no leave reasons (an
 * MC is nobody else's business).
 *
 * Unauthenticated by design — customers never log in.
 */
export async function publicShopSnapshot(branchId: string | null): Promise<ShopSnapshot | null> {
  const branch = branchId
    ? await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, tenantId: true },
      })
    : null;
  if (!branch) return null;

  const timeZone = await timezoneForTenant(branch.tenantId);
  const opsRules = await opsRulesFor(branch.tenantId);
  const today = shopToday(timeZone);
  const { ids, chairs } = await staffChairsAt([branch.id]);

  const [rosterRows, leaveRows] = await Promise.all([
    prisma.rosterDay.findMany({
      where: { staffId: { in: ids } },
      select: { staffId: true, weekday: true, off: true, start: true, end: true },
    }),
    prisma.staffLeave.findMany({
      where: {
        staffId: { in: ids },
        date: {
          gte: dateColumn(today),
          lte: dateColumn(addDays(today, opsRules.advanceDays)),
        },
      },
      select: { staffId: true, date: true },
    }),
  ]);

  return {
    opsRules,
    roster: toRoster(rosterRows),
    leaves: leaveRows.map((l) => ({
      id: `${l.staffId}:${isoOf(l.date)}`,
      staffId: l.staffId,
      date: isoOf(l.date),
      reason: "Away",
    })),
    shifts: [],
    staffChairs: chairs,
    branchIds: [branch.id],
  };
}
