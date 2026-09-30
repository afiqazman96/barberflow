import type {
  QueueSource as PrismaQueueSource,
  QueueStatus as PrismaQueueStatus,
} from "@/generated/prisma/enums";
import type { QueueStatus, QueueTicket } from "@/lib/types";

/**
 * Prisma spells the queue enums `IN_SERVICE`; the screens and the store spell
 * them `in-service`. Same bridge as `staff/status.ts`, for the same reason.
 */

const APP_STATUS: Record<PrismaQueueStatus, QueueStatus> = {
  WAITING: "waiting",
  CALLED: "called",
  IN_SERVICE: "in-service",
  AWAITING_PAYMENT: "awaiting-payment",
  COMPLETED: "completed",
  NO_SHOW: "no-show",
  CANCELLED: "cancelled",
};

const PRISMA_STATUS: Record<QueueStatus, PrismaQueueStatus> = {
  waiting: "WAITING",
  called: "CALLED",
  "in-service": "IN_SERVICE",
  "awaiting-payment": "AWAITING_PAYMENT",
  completed: "COMPLETED",
  "no-show": "NO_SHOW",
  cancelled: "CANCELLED",
};

export function appQueueStatusFor(status: PrismaQueueStatus): QueueStatus {
  return APP_STATUS[status];
}

/** Undefined for anything that is not a status — the value came from a client. */
export function prismaQueueStatusFor(
  status: string,
): PrismaQueueStatus | undefined {
  return PRISMA_STATUS[status as QueueStatus];
}

export function appQueueSourceFor(
  source: PrismaQueueSource,
): QueueTicket["source"] {
  switch (source) {
    case "QR":
      return "qr";
    case "CASHIER":
      return "cashier";
    case "BOOKING":
      return "booking";
  }
}
