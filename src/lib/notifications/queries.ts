import "server-only";

import { requireShopSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Staff } from "@/generated/prisma/client";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: string;
};

function visibilityWhere(staff: Pick<Staff, "tenantId" | "branchId" | "role">) {
  const base = {
    tenantId: staff.tenantId,
    visibleToRoles: { has: staff.role },
  };
  // Owners span every branch — no branch filter at all, not a `{}` placeholder
  // inside OR (Prisma drops an empty object from an OR list rather than
  // treating it as "always true", which silently hid every branch-scoped row).
  if (staff.role === "OWNER") return base;
  return { ...base, OR: [{ branchId: null }, { branchId: staff.branchId }] };
}

/** The signed-in staff member's own notifications, newest first. */
export async function notificationsFor(): Promise<{
  notifications: NotificationRow[];
  unreadCount: number;
}> {
  const { staff } = await requireShopSession();

  const rows = await prisma.notification.findMany({
    where: visibilityWhere(staff),
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, title: true, body: true, createdAt: true },
  });

  const seenAt = staff.notificationsSeenAt;
  const unreadCount = seenAt
    ? rows.filter((r) => r.createdAt > seenAt).length
    : rows.length;

  return {
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
    unreadCount,
  };
}
