import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { QueueStatus as PrismaQueueStatus } from "@/generated/prisma/enums";
import { requireShopSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { QueueTicket } from "@/lib/types";
import { maskName } from "@/lib/utils";

import { readOwnTicketId } from "./cookie";
import type { QueueSnapshot } from "./dto";
import { appQueueSourceFor, appQueueStatusFor } from "./status";

const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";

/** Tickets a stranger in the lobby may see — everyone still on the floor. */
const PUBLIC_STATUSES: PrismaQueueStatus[] = ["WAITING", "CALLED", "IN_SERVICE"];

export const ticketSelect = {
  id: true,
  number: true,
  branchId: true,
  customerId: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  preferredStaffId: true,
  assignedStaffId: true,
  chairId: true,
  status: true,
  source: true,
  estimatedWaitMins: true,
  createdAt: true,
  startedAt: true,
  services: {
    orderBy: { id: "asc" },
    select: { serviceId: true, name: true },
  },
  booking: { select: { id: true } },
} satisfies Prisma.QueueTicketSelect;

type TicketRow = Prisma.QueueTicketGetPayload<{ select: typeof ticketSelect }>;

/** A ticket row as the store's `QueueTicket`, with everything on it. */
export function toTicketDto(row: TicketRow): QueueTicket {
  return {
    id: row.id,
    number: row.number,
    branchId: row.branchId,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? "",
    customerEmail: row.customerEmail ?? undefined,
    serviceIds: row.services.map((s) => s.serviceId),
    serviceNames: row.services.map((s) => s.name),
    preferredStaffId: row.preferredStaffId,
    assignedStaffId: row.assignedStaffId,
    chairId: row.chairId,
    status: appQueueStatusFor(row.status),
    bookingId: row.booking?.id,
    estimatedWaitMins: row.estimatedWaitMins,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    source: appQueueSourceFor(row.source),
  };
}

/**
 * The same ticket as somebody else may see it: no contact details, a
 * shortened name, and no real id — the id is what proves a ticket is yours
 * (see `cookie.ts`), so it must not be handed to the rest of the queue.
 */
function toPublicTicketDto(row: TicketRow): QueueTicket {
  return {
    ...toTicketDto(row),
    id: `${row.branchId}:${row.number}`,
    customerId: "",
    customerName: maskName(row.customerName),
    customerPhone: "",
    customerEmail: undefined,
    bookingId: undefined,
  };
}

/**
 * The service day a ticket belongs to: the calendar date in the shop's own
 * timezone, stored at midnight UTC (see `QueueCounter.queueDate`).
 */
export function queueDateIn(timezone: string, now: Date = new Date()): Date {
  const ymd = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

  let day: string;
  try {
    day = ymd(timezone);
  } catch {
    // An unknown zone name in settings must not take the queue down.
    day = ymd(DEFAULT_TIMEZONE);
  }
  return new Date(`${day}T00:00:00.000Z`);
}

export async function queueDateForTenant(tenantId: string): Promise<Date> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  return queueDateIn(settings?.timezone ?? DEFAULT_TIMEZONE);
}

/**
 * Today's queue for the signed-in staff member.
 *
 * Cashiers and barbers get their own branch; an owner spans every branch in
 * the shop, so they get all of them and can switch without refetching. The
 * tenant and branch come from the session row, never from the request.
 */
export async function staffQueueSnapshot(): Promise<QueueSnapshot> {
  const { staff } = await requireShopSession();

  const branchIds = staff.branchId
    ? [staff.branchId]
    : (
        await prisma.branch.findMany({
          where: { tenantId: staff.tenantId },
          select: { id: true },
        })
      ).map((b) => b.id);

  const queueDate = await queueDateForTenant(staff.tenantId);

  const rows = await prisma.queueTicket.findMany({
    where: {
      tenantId: staff.tenantId,
      branchId: { in: branchIds },
      queueDate,
    },
    // Newest first — the order the store has always kept its queue in.
    orderBy: { createdAt: "desc" },
    select: ticketSelect,
  });

  return { tickets: rows.map(toTicketDto), branchIds };
}

/**
 * Today's queue for one branch as the lobby may see it, for the TV display and
 * for customers following their place in line.
 *
 * Unauthenticated by design — customers never log in — so it carries only
 * what is already on the lobby screen. The one exception is the caller's own
 * ticket, recognised by its cookie, which comes back whole. If that ticket is
 * at a different branch from the one asked for, its branch is included too, so
 * the tracking screen still works after a refresh.
 */
export async function publicQueueSnapshot(
  branchId: string | null,
): Promise<QueueSnapshot> {
  const ownId = await readOwnTicketId();
  const own = ownId
    ? await prisma.queueTicket.findUnique({
        where: { id: ownId },
        select: { ...ticketSelect, tenantId: true, queueDate: true },
      })
    : null;

  const tickets: QueueTicket[] = [];
  const branchIds: string[] = [];
  let ownTicketId: string | null = null;

  const branch = branchId
    ? await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, tenantId: true },
      })
    : null;

  // Yesterday's ticket is history, not a place in today's line.
  const ownIsCurrent =
    own !== null &&
    own.queueDate.getTime() ===
      (await queueDateForTenant(own.tenantId)).getTime();

  const scopes: { branchId: string; tenantId: string }[] = [];
  if (branch) scopes.push({ branchId: branch.id, tenantId: branch.tenantId });
  if (own && ownIsCurrent && own.branchId !== branch?.id) {
    scopes.push({ branchId: own.branchId, tenantId: own.tenantId });
  }

  for (const scope of scopes) {
    const queueDate = await queueDateForTenant(scope.tenantId);
    const rows = await prisma.queueTicket.findMany({
      where: {
        branchId: scope.branchId,
        queueDate,
        status: { in: PUBLIC_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      select: ticketSelect,
    });
    branchIds.push(scope.branchId);
    for (const row of rows) {
      if (row.id !== own?.id) tickets.push(toPublicTicketDto(row));
    }
  }

  if (own && ownIsCurrent) {
    ownTicketId = own.id;
    tickets.unshift(toTicketDto(own));
  }

  return { tickets, branchIds, ownTicketId };
}
