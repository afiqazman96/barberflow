import "server-only";

import type { QueueStatus as PrismaQueueStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Closes out tickets left open on an earlier day.
 *
 * Every screen shows only today's queue, so a ticket nobody finished before
 * midnight can never be finished afterwards — it would sit "in service" or
 * "waiting" forever and skew reports. Instead, the first time a shop's queue
 * is touched on a new day, whatever was left open is settled:
 *
 * - still waiting or called → `NO_SHOW`: they were never served, and a
 *   booking checked in to the ticket follows it;
 * - in service → `AWAITING_PAYMENT`: the service happened but was never sent
 *   to the till, so it is owed;
 * - awaiting payment → left alone.
 *
 * Nothing that may still be owed is closed. Unpaid tickets stay open and the
 * staff snapshot carries them past their day (`staffQueueSnapshot`), so the
 * counter can still settle them at the POS.
 *
 * Lazy rather than a scheduled job, so it needs no cron and works on plain
 * Postgres too. The writes fire the usual Realtime pokes.
 */

const UNSERVED: PrismaQueueStatus[] = ["WAITING", "CALLED"];
const SERVED: PrismaQueueStatus[] = ["IN_SERVICE"];

/**
 * Tenant → the queue day swept (or being swept), so it runs once per day per
 * server, and requests arriving together share the one run.
 */
const swept = new Map<string, { day: number; run: Promise<void> }>();

export function closeEarlierDays(tenantId: string, today: Date): Promise<void> {
  const day = today.getTime();
  const current = swept.get(tenantId);
  if (current?.day === day) return current.run;

  const run = sweep(tenantId, today).catch((error) => {
    // Try again on the next request rather than never for the rest of the day.
    swept.delete(tenantId);
    throw error;
  });
  swept.set(tenantId, { day, run });
  return run;
}

async function sweep(tenantId: string, today: Date): Promise<void> {
  const stale = await prisma.queueTicket.findMany({
    where: {
      tenantId,
      queueDate: { lt: today },
      status: { in: [...UNSERVED, ...SERVED] },
    },
    select: { id: true, status: true },
  });

  if (stale.length > 0) {
    const unserved = stale.filter((t) => UNSERVED.includes(t.status)).map((t) => t.id);
    const served = stale.filter((t) => SERVED.includes(t.status)).map((t) => t.id);

    // Each update re-checks the status, so a ticket someone moved in the
    // meantime is left as they left it.
    await prisma.$transaction([
      prisma.queueTicket.updateMany({
        where: { id: { in: unserved }, status: { in: UNSERVED } },
        data: { status: "NO_SHOW" },
      }),
      prisma.queueTicket.updateMany({
        where: { id: { in: served }, status: { in: SERVED } },
        data: { status: "AWAITING_PAYMENT", estimatedWaitMins: 0 },
      }),
      prisma.booking.updateMany({
        where: { queueTicketId: { in: unserved }, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        data: { status: "NO_SHOW" },
      }),
    ]);
  }
}
