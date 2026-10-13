import "server-only";

import type { Staff } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Wherever a barber or cashier is actually clocked in right now, falling
 * back to their home branch when no shift is open. Owners have no branch of
 * their own and are not shift-tracked — null means "every branch", same as
 * `Staff.branchId === null` already meant.
 */
export async function effectiveBranchIdFor(
  staff: Pick<Staff, "id" | "role" | "branchId">,
): Promise<string | null> {
  if (staff.role === "OWNER") return null;
  const open = await prisma.shift.findFirst({
    where: { staffId: staff.id, endedAt: null },
    select: { branchId: true },
  });
  return open?.branchId ?? staff.branchId ?? null;
}

/** Same, batched for several staff — one query instead of N. */
export async function effectiveBranchIdsFor(
  rows: Pick<Staff, "id" | "role" | "branchId">[],
): Promise<Map<string, string | null>> {
  const ids = rows.filter((r) => r.role !== "OWNER").map((r) => r.id);
  const open = ids.length
    ? await prisma.shift.findMany({
        where: { staffId: { in: ids }, endedAt: null },
        select: { staffId: true, branchId: true },
      })
    : [];
  const openBy = new Map(open.map((s) => [s.staffId, s.branchId]));
  return new Map(
    rows.map((r) => [
      r.id,
      r.role === "OWNER" ? null : (openBy.get(r.id) ?? r.branchId ?? null),
    ]),
  );
}
