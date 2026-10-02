"use client";

import { useQueueSync } from "@/hooks/use-queue-sync";
import { useAppStore } from "@/lib/store/app-store";

/**
 * Mount once per screen tree that shows the queue. Renders nothing — it keeps
 * the store's queue (and, with `bookings`, its appointments) live so the
 * screens below read them exactly as before.
 *
 * `staff` is for the signed-in portals; `public` is for customers and the
 * lobby display, and follows `branchId` (defaulting to the branch the store
 * has selected).
 */
export function QueueSync({
  scope,
  branchId,
  bookings = false,
}: {
  scope: "staff" | "public";
  branchId?: string;
  bookings?: boolean;
}) {
  const selectedBranchId = useAppStore((s) => s.branchId);
  useQueueSync(scope, branchId ?? selectedBranchId, bookings);
  return null;
}
