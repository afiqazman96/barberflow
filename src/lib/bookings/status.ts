import type { BookingStatus as PrismaBookingStatus } from "@/generated/prisma/enums";
import type { BookingStatus } from "@/lib/types";

/**
 * Prisma spells booking statuses `CHECKED_IN`; the screens spell them
 * `checked-in`. Same bridge as `queue/status.ts`.
 */

const APP_STATUS: Record<PrismaBookingStatus, BookingStatus> = {
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked-in",
  IN_SERVICE: "in-service",
  COMPLETED: "completed",
  NO_SHOW: "no-show",
  CANCELLED: "cancelled",
};

const PRISMA_STATUS: Record<BookingStatus, PrismaBookingStatus> = {
  confirmed: "CONFIRMED",
  "checked-in": "CHECKED_IN",
  "in-service": "IN_SERVICE",
  completed: "COMPLETED",
  "no-show": "NO_SHOW",
  cancelled: "CANCELLED",
};

export function appBookingStatusFor(status: PrismaBookingStatus): BookingStatus {
  return APP_STATUS[status];
}

/** Undefined for anything that is not a status — the value came from a client. */
export function prismaBookingStatusFor(
  status: string,
): PrismaBookingStatus | undefined {
  return PRISMA_STATUS[status as BookingStatus];
}
