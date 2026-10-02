import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { CashMovementType, DrawerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { CashMovement, DrawerSession } from "@/lib/types";

/** How far back the owner's drawer history goes. */
const HISTORY_DAYS = 62;
const HISTORY_LIMIT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const MOVEMENT_TYPE = {
  SALE: "sale",
  REFUND: "refund",
  PAY_IN: "pay-in",
  PAY_OUT: "pay-out",
} as const satisfies Record<CashMovementType, CashMovement["type"]>;

const STATUS = {
  CLOSED: "closed",
  NEEDS_REVIEW: "needs-review",
  REVIEWED: "reviewed",
} as const satisfies Record<DrawerStatus, NonNullable<DrawerSession["status"]>>;

export const drawerSelect = {
  id: true,
  branchId: true,
  cashierId: true,
  cashierName: true,
  openedAt: true,
  openingFloat: true,
  floatMismatch: true,
  closedAt: true,
  closedByName: true,
  closedByOwner: true,
  countedAmount: true,
  denominations: true,
  counts: true,
  expectedAtClose: true,
  variance: true,
  status: true,
  closingNote: true,
  varianceReason: true,
  reviewedByName: true,
  reviewedAt: true,
  reviewNote: true,
  movements: {
    orderBy: { at: "asc" },
    select: {
      id: true,
      type: true,
      amount: true,
      note: true,
      category: true,
      saleId: true,
      byName: true,
      at: true,
    },
  },
} satisfies Prisma.DrawerSessionSelect;

type DrawerRow = Prisma.DrawerSessionGetPayload<{ select: typeof drawerSelect }>;

/** One attempt at the close, as stored in `drawer_sessions.counts`. */
export type StoredCount = {
  amount: number;
  at: string;
  denominations?: Record<string, number>;
};

/** What should be in the drawer now: the float plus every movement since. */
export function expectedCash(row: {
  openingFloat: Prisma.Decimal | number;
  movements: { amount: Prisma.Decimal | number }[];
}): number {
  const total =
    Number(row.openingFloat) + row.movements.reduce((sum, m) => sum + Number(m.amount), 0);
  return Math.round(total * 100) / 100;
}

const num = (d: Prisma.Decimal | null) => (d === null ? undefined : Number(d));

export function toDrawerDto(row: DrawerRow): DrawerSession {
  const denominations = row.denominations as Record<string, number> | null;
  return {
    id: row.id,
    branchId: row.branchId,
    cashierId: row.cashierId ?? "",
    cashierName: row.cashierName,
    openedAt: row.openedAt.toISOString(),
    openingFloat: Number(row.openingFloat),
    movements: row.movements.map((m) => ({
      id: m.id,
      type: MOVEMENT_TYPE[m.type],
      amount: Number(m.amount),
      note: m.note,
      at: m.at.toISOString(),
      saleId: m.saleId ?? undefined,
      by: m.byName ?? undefined,
      category: m.category ?? undefined,
    })),
    closedAt: row.closedAt?.toISOString(),
    closedBy: row.closedByName ?? undefined,
    closedByOwner: row.closedByOwner || undefined,
    countedAmount: num(row.countedAmount),
    denominations: denominations ?? undefined,
    counts: (row.counts as StoredCount[] | null) ?? [],
    expectedAtClose: num(row.expectedAtClose),
    variance: num(row.variance),
    status: row.status ? STATUS[row.status] : undefined,
    closingNote: row.closingNote ?? undefined,
    varianceReason: row.varianceReason ?? undefined,
    reviewedBy: row.reviewedByName ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    reviewNote: row.reviewNote ?? undefined,
    floatMismatch: num(row.floatMismatch),
  };
}

/**
 * A cashier counts blind: they never learn what the drawer should hold, so a
 * count can't be fitted to it. Their copy keeps the till's history — what was
 * taken, paid in or out — but not the cash-sale amounts that would add up to
 * the expected figure, nor the expected figure and variance of past closes.
 */
function forCashier(drawer: DrawerSession): DrawerSession {
  return {
    ...drawer,
    movements: drawer.movements.map((m) =>
      m.type === "sale" || m.type === "refund" ? { ...m, amount: 0 } : m,
    ),
    expectedAtClose: undefined,
    variance: undefined,
    floatMismatch: undefined,
  };
}

/** The open drawers and recent closes at the given branches. */
export async function drawersAt(
  tenantId: string,
  branchIds: string[],
  role: "OWNER" | "CASHIER",
): Promise<{ open: DrawerSession[]; history: DrawerSession[] }> {
  const [open, closed] = await Promise.all([
    prisma.drawerSession.findMany({
      where: { tenantId, branchId: { in: branchIds }, closedAt: null },
      select: drawerSelect,
    }),
    prisma.drawerSession.findMany({
      where: {
        tenantId,
        branchId: { in: branchIds },
        closedAt: { not: null, gte: new Date(Date.now() - HISTORY_DAYS * DAY_MS) },
      },
      orderBy: { closedAt: "desc" },
      take: HISTORY_LIMIT,
      select: drawerSelect,
    }),
  ]);

  const shape = (row: DrawerRow) =>
    role === "OWNER" ? toDrawerDto(row) : forCashier(toDrawerDto(row));
  return { open: open.map(shape), history: closed.map(shape) };
}
