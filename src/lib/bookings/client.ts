import { toast } from "sonner";

import type { QueueScope } from "@/lib/queue/client";
import { requestQueueRefetch } from "@/lib/queue/client";

import { updateBookingStatus } from "./actions";
import type { BookingsSnapshot, BookingStatusChange } from "./dto";

/**
 * The browser's side of appointments. Like `queue/client.ts`, it does not
 * import the store — the store imports this.
 */

/** Null when the snapshot could not be read; the caller keeps what it has. */
export async function fetchBookingsSnapshot(
  scope: QueueScope,
): Promise<BookingsSnapshot | null> {
  const url =
    scope.kind === "staff"
      ? "/api/bookings"
      : `/api/bookings/public?branch=${encodeURIComponent(scope.branchId)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as BookingsSnapshot;
  } catch {
    return null;
  }
}

const CHANGEABLE = new Set<string>(["in-service", "completed", "no-show", "cancelled"]);

/**
 * Persist a status change the store has already applied locally. On refusal,
 * say so and re-read, which replaces the optimistic state with the truth.
 */
export function pushBookingStatus(id: string, status: string): void {
  if (!CHANGEABLE.has(status)) return;

  const failed = (description?: string) => {
    toast.error("Couldn't update the appointment", { description });
    requestQueueRefetch();
  };

  updateBookingStatus(id, status as BookingStatusChange).then(
    (result) => {
      if (!result.ok) failed(result.error);
    },
    () => failed("Check your connection and try again"),
  );
}
