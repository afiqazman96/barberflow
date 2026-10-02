import type { Booking, BookingStatus } from "@/lib/types";

/**
 * What crosses to the browser for appointments. Outside the server modules so
 * Client Components can import the types (same reason as `queue/dto.ts`).
 */

/**
 * Sent on the branch's queue topic (`queueTopic`) by the trigger in
 * `20261002010000_bookings_realtime`.
 */
export const BOOKINGS_CHANGED_EVENT = "booking_changed";

export type BookingsSnapshot = {
  bookings: Booking[];
  /** Every branch this snapshot speaks for; their bookings are replaced. */
  branchIds: string[];
  /**
   * Public snapshots only: the booking this device made, resolved from its
   * cookie. Everyone else's bookings are reduced to the slot they hold.
   */
  ownBookingId?: string | null;
};

export type BookingInput = {
  branchId: string;
  name: string;
  phone: string;
  email?: string;
  serviceIds: string[];
  /** Null means "Any Barber". */
  staffId: string | null;
  /** The shop's wall clock: `YYYY-MM-DD` and `HH:MM`. */
  date: string;
  time: string;
  /** The hold the screen showed; the tenant default when absent. */
  gracePeriodMins?: number;
};

export type CreateBookingResult =
  /** `member`: a customer's own booking matched a member (see `CreateTicketResult`). */
  | { ok: true; data: { booking: Booking; member?: boolean } }
  | { ok: false; error: string };

/** The statuses a staff screen may set directly; check-in has its own action. */
export type BookingStatusChange = Extract<
  BookingStatus,
  "in-service" | "completed" | "no-show" | "cancelled"
>;
