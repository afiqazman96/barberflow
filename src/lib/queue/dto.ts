import type { QueueStatus, QueueTicket } from "@/lib/types";

/**
 * What crosses to the browser for the queue.
 *
 * Lives outside `queries.ts` / `actions.ts` for the same reason as
 * `staff/dto.ts`: those are server modules, and Client Components must be able
 * to import these types.
 */

/**
 * The Realtime topic a branch's queue pokes are broadcast on. Must match the
 * trigger in `20260930000000_queue_realtime_broadcast`.
 */
export function queueTopic(branchId: string): string {
  return `queue:branch:${branchId}`;
}

/** The broadcast event name the trigger sends. */
export const QUEUE_CHANGED_EVENT = "ticket_changed";

/**
 * Today's tickets for one or more branches, in the store's own `QueueTicket`
 * shape so the screens that read `s.queue` do not change.
 */
export type QueueSnapshot = {
  tickets: QueueTicket[];
  /** Every branch this snapshot speaks for — also the topics to listen on. */
  branchIds: string[];
  /**
   * Public snapshots only: the ticket this device joined with, resolved from
   * its cookie. Other people's tickets in the same snapshot are masked.
   */
  ownTicketId?: string | null;
};

export type TicketInput = {
  branchId: string;
  name: string;
  phone?: string;
  email?: string;
  serviceIds: string[];
  /** Null means "Any Barber". */
  preferredStaffId: string | null;
  /** The estimate the screen showed the customer, so the two agree. */
  estimatedWaitMins: number;
};

export type WalkInInput = TicketInput & {
  /** A CRM record the counter already picked; ignored unless it is ours. */
  customerId?: string;
  source: "cashier" | "booking";
};

export type CreateTicketResult =
  | { ok: true; data: { ticket: QueueTicket } }
  | {
      ok: false;
      error: string;
      /**
       * Set when the same contact is already in line. `own` says whether it is
       * this device's ticket; the number is only disclosed when it is.
       */
      duplicate?: { own: boolean; number?: string };
    };

/** The only ticket fields a staff screen may change. */
export type TicketPatch = {
  status: QueueStatus;
  assignedStaffId?: string | null;
  chairId?: string | null;
};
