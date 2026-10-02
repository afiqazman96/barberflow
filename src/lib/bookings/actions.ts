"use server";

import type { BookingStatus as PrismaBookingStatus } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { resolveCustomerId } from "@/lib/customers/resolve";
import { prisma } from "@/lib/prisma";

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
  /** Customers may only book ahead; the counter may record one after the fact. */
  allowPast: boolean;
};

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

  const barbers = await prisma.staff.findMany({
    where: { tenantId, branchId: input.branchId, role: "BARBER", active: true },
    select: { id: true, name: true },
  });
  const barber = input.staffId
    ? barbers.find((b) => b.id === input.staffId)
    : null;
  if (input.staffId && !barber) {
    return { ok: false, error: "That barber isn't at this branch" };
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

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { defaultGracePeriodMins: true },
  });
  const gracePeriodMins = Number.isFinite(input.gracePeriodMins)
    ? Math.min(MAX_GRACE_MINS, Math.max(0, Math.round(input.gracePeriodMins!)))
    : (settings?.defaultGracePeriodMins ?? 10);

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
  if (result.ok) {
    await rememberOwnBooking(result.data.booking.id);
  }
  return result;
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

  const cancelled = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      // Once checked in they are in the queue — leaving is done from there.
      status: "CONFIRMED",
      scheduledAt: { gt: new Date() },
    },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) {
    return { ok: false, error: "This booking can no longer be cancelled online" };
  }

  return { ok: true };
}
