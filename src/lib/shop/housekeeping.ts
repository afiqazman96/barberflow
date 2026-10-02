import "server-only";

import { instantToShopTime, shopTimeToInstant } from "@/lib/bookings/time";
import { prisma } from "@/lib/prisma";
import { AUTO_CLOSE_GRACE_MINS, closingMins, hhmmToMins } from "@/lib/roster";

/**
 * Ends shifts somebody forgot to end — the same rule the screens used to apply
 * in the browser, now applied once for everyone:
 *
 * - a shift from an earlier day is closed at that day's closing time;
 * - today's is closed at closing time once closing + `AUTO_CLOSE_GRACE_MINS`
 *   has passed. A shift started after closing (stock take, late clean-up)
 *   stays open until the next day rather than closing with zero minutes;
 * - nobody is clocked out mid-service.
 *
 * Closing a shift takes the person off duty, frees their chair, and releases
 * customers who asked for them — as clocking out does.
 *
 * Lazy (run from the staff snapshot) rather than scheduled, like the queue's
 * close-out, and at most every few minutes per shop per server.
 */

const RECHECK_MS = 5 * 60 * 1000;
const lastRun = new Map<string, number>();

const hhmm = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export async function closeStaleShifts(tenantId: string, timeZone: string): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - (lastRun.get(tenantId) ?? 0) < RECHECK_MS) return;
  lastRun.set(tenantId, nowMs);

  try {
    await sweep(tenantId, timeZone, new Date(nowMs));
  } catch (error) {
    // Try again on the next request rather than in five minutes.
    lastRun.delete(tenantId);
    throw error;
  }
}

async function sweep(tenantId: string, timeZone: string, now: Date) {
  const open = await prisma.shift.findMany({
    where: { tenantId, endedAt: null },
    select: {
      id: true,
      staffId: true,
      date: true,
      startedAt: true,
      branch: { select: { openHours: true } },
    },
  });
  if (open.length === 0) return;

  const { date: today, time: nowTime } = instantToShopTime(now, timeZone);
  const nowMins = hhmmToMins(nowTime);

  for (const shift of open) {
    const date = shift.date.toISOString().slice(0, 10);
    const close = closingMins({ openHours: shift.branch.openHours ?? "" });
    const startedMins = hhmmToMins(instantToShopTime(shift.startedAt, timeZone).time);
    const stale =
      date < today ||
      (date === today && startedMins < close && nowMins >= close + AUTO_CLOSE_GRACE_MINS);
    if (!stale) continue;

    const serving = await prisma.queueTicket.count({
      where: { assignedStaffId: shift.staffId, status: "IN_SERVICE" },
    });
    if (serving > 0) continue;

    const closeAt = shopTimeToInstant(date, hhmm(Math.min(close, 23 * 60 + 59)), timeZone);
    const endedAt =
      closeAt && closeAt > shift.startedAt ? closeAt : shift.startedAt;

    await prisma.$transaction(async (tx) => {
      const closed = await tx.shift.updateMany({
        where: { id: shift.id, endedAt: null },
        data: { endedAt, endedBy: "AUTO", note: "Auto-closed: shift was not ended" },
      });
      if (closed.count === 0) return;
      await tx.staff.update({
        where: { id: shift.staffId },
        data: { status: "OFF_DUTY", chairId: null },
      });
      await tx.queueTicket.updateMany({
        where: {
          tenantId,
          preferredStaffId: shift.staffId,
          status: { in: ["WAITING", "CALLED"] },
        },
        data: { preferredStaffId: null },
      });
    });
  }
}
