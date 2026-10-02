import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus as PrismaBookingStatus } from "@/generated/prisma/enums";
import { requireShopSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Booking } from "@/lib/types";

import { readOwnBookingId } from "./cookie";
import type { BookingsSnapshot } from "./dto";
import { appBookingStatusFor } from "./status";
import { instantToShopTime } from "./time";

const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

/** How far back staff screens (history, reports) see appointments. */
const HISTORY_DAYS = 90;

/** How far ahead a customer can see which slots are taken. */
const PUBLIC_AHEAD_DAYS = 62;

/** Bookings that still hold their slot. */
export const HOLDING: PrismaBookingStatus[] = ["CONFIRMED", "CHECKED_IN"];

const DAY_MS = 24 * 60 * 60 * 1000;

export const bookingSelect = {
  id: true,
  branchId: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  staffId: true,
  staff: { select: { name: true } },
  scheduledAt: true,
  durationMins: true,
  gracePeriodMins: true,
  status: true,
  notes: true,
  services: {
    orderBy: { id: "asc" },
    select: { serviceId: true, name: true },
  },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

export async function timezoneForTenant(tenantId: string): Promise<string> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  return settings?.timezone ?? DEFAULT_TIMEZONE;
}

/** A booking row as the store's `Booking`, on the shop's own clock. */
export function toBookingDto(row: BookingRow, timeZone: string): Booking {
  const { date, time } = instantToShopTime(row.scheduledAt, timeZone);
  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? "",
    customerEmail: row.customerEmail ?? undefined,
    serviceIds: row.services.map((s) => s.serviceId),
    serviceNames: row.services.map((s) => s.name),
    staffId: row.staffId,
    staffName: row.staff?.name ?? "Any Barber",
    date,
    time,
    durationMins: row.durationMins,
    gracePeriodMins: row.gracePeriodMins,
    status: appBookingStatusFor(row.status),
    notes: row.notes ?? undefined,
  };
}

/**
 * Somebody else's booking as a customer may see it: only the slot it holds
 * and who it is with, which is what the booking form needs to grey out a
 * time. No name, no contact, no services, and no real id — the id is what
 * proves a booking is yours (see `cookie.ts`).
 */
function toSlotDto(row: BookingRow, timeZone: string, index: number): Booking {
  return {
    ...toBookingDto(row, timeZone),
    id: `${row.branchId}:${row.scheduledAt.getTime()}:${index}`,
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: undefined,
    serviceIds: [],
    serviceNames: [],
    notes: undefined,
  };
}

/**
 * Appointments for the signed-in staff member's shop: the last
 * `HISTORY_DAYS` and everything ahead. Owners get every branch, everyone else
 * their own — the tenant and branch come from the session row.
 */
export async function staffBookingsSnapshot(): Promise<BookingsSnapshot> {
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
  const rows = await prisma.booking.findMany({
    where: {
      tenantId: staff.tenantId,
      branchId: { in: branchIds },
      scheduledAt: { gte: new Date(Date.now() - HISTORY_DAYS * DAY_MS) },
    },
    orderBy: { scheduledAt: "asc" },
    select: bookingSelect,
  });

  return {
    bookings: rows.map((row) => toBookingDto(row, timeZone)),
    branchIds,
  };
}

/**
 * The taken slots at one branch for the customer booking form, plus the
 * caller's own booking (from its cookie) in full, wherever it is.
 *
 * Unauthenticated by design — customers never log in.
 */
export async function publicBookingsSnapshot(
  branchId: string | null,
): Promise<BookingsSnapshot> {
  const ownId = await readOwnBookingId();
  const own = ownId
    ? await prisma.booking.findUnique({
        where: { id: ownId },
        select: { ...bookingSelect, tenantId: true },
      })
    : null;

  const branch = branchId
    ? await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, tenantId: true },
      })
    : null;

  const bookings: Booking[] = [];
  const branchIds: string[] = [];

  if (branch) {
    const timeZone = await timezoneForTenant(branch.tenantId);
    // From a day back, so "today" is covered in every timezone.
    const now = Date.now();
    const rows = await prisma.booking.findMany({
      where: {
        branchId: branch.id,
        status: { in: HOLDING },
        scheduledAt: {
          gte: new Date(now - DAY_MS),
          lte: new Date(now + PUBLIC_AHEAD_DAYS * DAY_MS),
        },
      },
      orderBy: { scheduledAt: "asc" },
      select: bookingSelect,
    });
    branchIds.push(branch.id);
    rows.forEach((row, i) => {
      if (row.id !== own?.id) bookings.push(toSlotDto(row, timeZone, i));
    });
  }

  // The own booking may be at another branch than the one asked for. It is
  // returned anyway, but that branch is not listed in `branchIds`: the store
  // upserts it rather than treating its branch as fully known.
  if (own) {
    bookings.unshift(toBookingDto(own, await timezoneForTenant(own.tenantId)));
  }

  return { bookings, branchIds, ownBookingId: own?.id ?? null };
}
