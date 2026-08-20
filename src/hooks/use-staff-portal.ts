"use client";

import { useMemo } from "react";
import { useSession } from "@/components/auth/session-provider";
import { useAppStore } from "@/lib/store/app-store";
import type { QueueTicket, StaffMember, StaffStatus } from "@/lib/types";

/**
 * Everything the staff portal screens read about "me".
 *
 * `staffId` comes from the session the layout guard resolved on the server —
 * the portal cannot render without one, so there is no anonymous fallback to
 * pick a barber at random.
 */
export function useStaffPortal() {
  const staffId = useSession().staffId ?? "";
  const staffStatuses = useAppStore((s) => s.staffStatuses);
  const queue = useAppStore((s) => s.queue);
  const sales = useAppStore((s) => s.sales);
  const staffList = useAppStore((s) => s.staff);
  const chairs = useAppStore((s) => s.chairs);
  const updateStaffStatus = useAppStore((s) => s.updateStaffStatus);
  const updateQueueTicket = useAppStore((s) => s.updateQueueTicket);
  const assignChair = useAppStore((s) => s.assignChair);

  const staff: StaffMember = useMemo(
    () =>
      staffList.find((s) => s.id === staffId) ??
      staffList.find((s) => s.role === "barber") ??
      staffList[0],
    [staffId, staffList],
  );

  const status: StaffStatus = staffStatuses[staffId] ?? staff?.status ?? "off-duty";

  const chair = useMemo(
    () =>
      chairs.find((c) => c.staffId === staffId) ??
      chairs.find((c) => c.id === staff?.chairId) ??
      null,
    [chairs, staff?.chairId, staffId],
  );

  const currentTicket = useMemo(
    () =>
      queue.find(
        (q) => q.assignedStaffId === staffId && q.status === "in-service",
      ),
    [queue, staffId],
  );

  const staffSales = useMemo(
    () => sales.filter((s) => s.staffId === staffId),
    [sales, staffId],
  );

  const historyTickets = useMemo(
    () =>
      queue.filter(
        (q) =>
          q.assignedStaffId === staffId &&
          (q.status === "completed" || q.status === "awaiting-payment"),
      ),
    [queue, staffId],
  );

  return {
    staffId,
    staff,
    status,
    chair,
    chairs,
    currentTicket,
    staffSales,
    historyTickets,
    queue,
    updateStaffStatus,
    updateQueueTicket,
    assignChair,
  };
}

export function findNextQueueTicket(
  queue: QueueTicket[],
  staffId: string,
): QueueTicket | undefined {
  const waiting = queue.filter((q) => q.status === "waiting");
  const preferred = waiting.filter((q) => q.preferredStaffId === staffId);
  const any = waiting.filter((q) => !q.preferredStaffId);

  const sortByCreated = (a: QueueTicket, b: QueueTicket) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (preferred.length > 0) return [...preferred].sort(sortByCreated)[0];
  if (any.length > 0) return [...any].sort(sortByCreated)[0];
  return undefined;
}
