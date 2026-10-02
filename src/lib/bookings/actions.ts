"use server";

import type { BookingStatus as PrismaBookingStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { resolveCustomerId } from "@/lib/customers/resolve";
import { prisma } from "@/lib/prisma";
import { closingMins, hhmmToMins, openingMins } from "@/lib/roster";
import { addDays, dateColumn, opsRulesFor, shopToday } from "@/lib/shop/queries";

import { readOwnBookingId, rememberOwnBooking } from "./cookie";
import type {
  BookingInput,
  BookingStatusChange,
  CreateBookingResult,
} from "./dto";
import {
  bookingSelect,
  HOLDING,
  timezoneForTenant,
  toBookingDto,
} from "./queries";
import { prismaBookingStatusFor } from "./status";
import { shopTimeToInstant } from "./time";

/**
 * Every write to appointments.
 *
 * Like the queue, nothing here publishes to Realtime: a trigger on `bookings`
 * pokes the branch topic for every committed write, whoever made it.
 *
 * Checking a booking in creates a queue ticket, so it lives with the queue in
 * `queue/actions.ts` (`checkInBooking`).
 */

/** Where a booking may be moved from, per destination. */
const MAY_MOVE_FROM: Record<BookingStatusChange, PrismaBookingStatus[]> = {
  "in-service": ["CHECKED_IN"],
  completed: ["CONFIRMED", "CHECKED_IN", "IN_SERVICE"],
  "no-show": ["CONFIRMED", "CHECKED_IN"],
  cancelled: ["CONFIRMED", "CHECKED_IN"],
};

const MAX_GRACE_MINS = 120;

type CreateArgs = {
  tenantId: string;
  input: BookingInput;
  /**
   * Customers are held to the shop's rules: ahead of now, inside the booking
   * window, during opening hours, with a barber rostered on and not on leave.
   * The counter may book outside them (after the fact, a favour, a walk-in
   * recorded late) — that is the owner's or cashier's call.
   */
  allowPast: boolean;
};

/**
 * The barbers rostered on at `time` on `date`, and not on leave — the same
 * rule the booking form greys slots out by. Null when the shop is closed then.
 */
async function barbersWorkingAt(
  branchId: string,
  barberIds: string[],
  date: string,
  time: string,
  slotMins: number,
): Promise<Set<string> | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { openHours: true },
  });
  const hours = { openHours: branch?.openHours ?? "" };
  const start = hhmmToMins(time);
  if (start < openingMins(hours) || start + slotMins > closingMins(hours)) {
    return null;
  }

  const weekday = dateColumn(date).getUTCDay();
  const [days, away] = await Promise.all([
    prisma.rosterDay.findMany({
      where: { staffId: { in: barberIds }, weekday, off: false },
      select: { staffId: true, start: true, end: true },
    }),
    prisma.staffLeave.findMany({
      where: { staffId: { in: barberIds }, date: dateColumn(date) },
      select: { staffId: true },
    }),
  ]);
  const onLeave = new Set(away.map((l) => l.staffId));
  return new Set(
    days
      .filter(
        (d) =>
          !onLeave.has(d.staffId) &&
          start >= hhmmToMins(d.start) &&
          start + slotMins <= hhmmToMins(d.end),
      )
      .map((d) => d.staffId),
  );
}

async function createBooking({
  tenantId,
  input,
  allowPast,
}: CreateArgs): Promise<CreateBookingResult> {
  const name = input.name.trim();
  const phone = input.phone.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  if (name.length === 0) {
    return { ok: false, error: "Name is required" };
  }
  if (!phone) {
    return { ok: false, error: "A phone number is required" };
  }

  const timeZone = await timezoneForTenant(tenantId);
  const scheduledAt = shopTimeToInstant(input.date, input.time, timeZone);
  if (!scheduledAt) {
    return { ok: false, error: "Pick a date and time" };
  }
  if (!allowPast && scheduledAt.getTime() <= Date.now()) {
    return { ok: false, error: "That time has already passed" };
  }

  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length === 0) {
    return { ok: false, error: "Pick a service" };
  }
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, tenantId, active: true },
    select: { id: true, name: true, price: true, durationMins: true },
  });
  if (services.length !== serviceIds.length) {
    return { ok: false, error: "That service is no longer available" };
  }
  const ordered = serviceIds.map((id) => services.find((s) => s.id === id)!);

  const branchBarbers = await prisma.staff.findMany({
    where: { tenantId, branchId: input.branchId, role: "BARBER", active: true },
    select: { id: true, name: true },
  });
  const barber = input.staffId
    ? branchBarbers.find((b) => b.id === input.staffId)
    : null;
  if (input.staffId && !barber) {
    return { ok: false, error: "That barber isn't at this branch" };
  }

  let barbers = branchBarbers;
  const rules = await opsRulesFor(tenantId);
  if (!allowPast) {
    const today = shopToday(timeZone);
    // The window counts today, as the booking form does: 7 days is today + 6.
    if (input.date >= addDays(today, rules.advanceDays)) {
      return {
        ok: false,
        error: `Bookings open ${rules.advanceDays} days ahead`,
      };
    }
    const working = await barbersWorkingAt(
      input.branchId,
      branchBarbers.map((b) => b.id),
      input.date,
      input.time,
      rules.slotInterval,
    );
    if (!working) {
      return { ok: false, error: "The shop is closed at that time" };
    }
    if (barber && !working.has(barber.id)) {
      return { ok: false, error: `${barber.name} isn't working at ${input.time}` };
    }
    barbers = branchBarbers.filter((b) => working.has(b.id));
  }

  // The same rule the booking form greys slots out by, checked again here
  // because the slot may have gone while the form was open.
  const taken = await prisma.booking.findMany({
    where: { branchId: input.branchId, scheduledAt, status: { in: HOLDING } },
    select: { staffId: true },
  });
  if (barber && taken.some((b) => b.staffId === barber.id)) {
    return { ok: false, error: `${barber.name} is already booked at ${input.time}` };
  }
  if (taken.length >= barbers.length) {
    return { ok: false, error: `${input.time} is fully booked` };
  }

  // A customer gets the shop's grace period; the counter may set another.
  const gracePeriodMins =
    allowPast && Number.isFinite(input.gracePeriodMins)
      ? Math.min(MAX_GRACE_MINS, Math.max(0, Math.round(input.gracePeriodMins!)))
      : rules.gracePeriodMins;

  const customerId = await resolveCustomerId(tenantId, { name, phone, email });

  const row = await prisma.booking.create({
    data: {
      tenantId,
      branchId: input.branchId,
      customerId,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      staffId: barber?.id ?? null,
      scheduledAt,
      durationMins: ordered.reduce((sum, s) => sum + s.durationMins, 0),
      gracePeriodMins,
      services: {
        create: ordered.map((s) => ({
          serviceId: s.id,
          name: s.name,
          price: s.price,
          durationMins: s.durationMins,
        })),
      },
    },
    select: bookingSelect,
  });

  return { ok: true, data: { booking: toBookingDto(row, timeZone) } };
}

/**
 * A customer books from their own phone. Unauthenticated by design; the
 * tenant is read off the branch, so a booking can only land in that shop.
 */
export async function bookAppointment(
  input: BookingInput,
): Promise<CreateBookingResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: { tenantId: true, tenant: { select: { status: true } } },
  });
  if (!branch || branch.tenant.status === "SUSPENDED") {
    return { ok: false, error: "This shop isn't taking bookings right now" };
  }
  if (!input.email?.trim()) {
    return { ok: false, error: "A valid email is required for your receipt" };
  }

  const result = await createBooking({
    tenantId: branch.tenantId,
    input,
    allowPast: false,
  });
  if (!result.ok) return result;

  await rememberOwnBooking(result.data.booking.id);
  const row = await prisma.booking.findUnique({
    where: { id: result.data.booking.id },
    select: { customer: { select: { membership: true } } },
  });
  const member = !!row?.customer && row.customer.membership !== "NONE";
  return { ok: true, data: { ...result.data, member } };
}

/** The owner or counter books someone in by phone or at the desk. */
export async function createStaffBooking(
  input: BookingInput,
): Promise<CreateBookingResult> {
  const { staff } = await requireRole("OWNER", "CASHIER");

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, tenantId: staff.tenantId },
    select: { id: true },
  });
  if (!branch || (staff.branchId && staff.branchId !== branch.id)) {
    return { ok: false, error: "Branch not found" };
  }

  return createBooking({ tenantId: staff.tenantId, input, allowPast: true });
}

/**
 * Complete, no-show or cancel a booking. Conditional on the status it may
 * come from, so two screens acting at once cannot undo each other.
 *
 * A booking that is cancelled or missed after check-in takes its place in
 * line with it: the waiting ticket goes the same way, in the same transaction.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatusChange,
): Promise<ActionResult> {
  const { staff } = await requireRole("OWNER", "CASHIER");

  const target = prismaBookingStatusFor(status);
  const from = MAY_MOVE_FROM[status];
  if (!target || !from) {
    return { ok: false, error: "Unknown status" };
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId: staff.tenantId },
    select: { id: true, branchId: true, status: true, queueTicketId: true },
  });
  if (!booking || (staff.branchId && staff.branchId !== booking.branchId)) {
    return { ok: false, error: "Appointment not found" };
  }
  if (booking.status === target) {
    return { ok: true };
  }

  const moved = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: { in: from } },
      data: { status: target },
    });
    if (updated.count > 0 && booking.queueTicketId && (target === "NO_SHOW" || target === "CANCELLED")) {
      await tx.queueTicket.updateMany({
        where: { id: booking.queueTicketId, status: { in: ["WAITING", "CALLED"] } },
        data: { status: target },
      });
    }
    return updated.count;
  });
  if (moved === 0) {
    return { ok: false, error: "That appointment has already moved on" };
  }

  return { ok: true };
}

/** The customer cancels the booking this device made, found by its cookie. */
export async function cancelMyBooking(): Promise<ActionResult> {
  const bookingId = await readOwnBookingId();
  if (!bookingId) {
    return { ok: false, error: "We couldn't find your booking on this device" };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { tenantId: true, branch: { select: { phone: true } } },
  });
  if (!booking) {
    return { ok: false, error: "We couldn't find your booking on this device" };
  }
  const { cancelHours } = await opsRulesFor(booking.tenantId);

  const cancelled = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      // Once checked in they are in the queue — leaving is done from there.
      status: "CONFIRMED",
      scheduledAt: { gt: new Date(Date.now() + cancelHours * 3600_000) },
    },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) {
    return {
      ok: false,
      error: `Cancellations close ${cancelHours}h before the appointment — please call ${booking.branch.phone ?? "the shop"}`,
    };
  }

  return { ok: true };
}
