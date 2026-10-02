"use server";

import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { isUniqueViolation } from "@/lib/customers/resolve";
import {
  CASHIER_PAYOUT_LIMIT,
  DRAWER_VARIANCE_TOLERANCE,
  MIN_VARIANCE_REASON,
  NOTE_DENOMINATIONS,
  COINS_KEY,
} from "@/lib/drawer";
import { prisma } from "@/lib/prisma";

import type { CloseDrawerResult } from "./dto";
import { expectedCash, type StoredCount } from "./drawer";

/**
 * Every write to the till. Cash sales and refunds are recorded with the sale
 * itself (`sales/actions.ts`); these are the cashier's and owner's own moves.
 *
 * The rules the screens have always shown are enforced here, where they can't
 * be skipped: on shift to open, one till per branch, the drawer's own cashier
 * for cash in and out, a cap on what a cashier may take out, and a blind count
 * at close — bounced once, then a written reason and the owner's review.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** The caller's branch: their own, or — for the owner — the one they name. */
async function branchFor(
  me: { tenantId: string; branchId: string | null },
  branchId: string,
) {
  if (me.branchId && me.branchId !== branchId) return null;
  return prisma.branch.findFirst({
    where: { id: branchId, tenantId: me.tenantId },
    select: { id: true },
  });
}

function openDrawerAt(branchId: string) {
  return prisma.drawerSession.findFirst({
    where: { branchId, closedAt: null },
    select: {
      id: true,
      cashierId: true,
      cashierName: true,
      openingFloat: true,
      counts: true,
      movements: { select: { amount: true } },
    },
  });
}

/** Only notes and coins we know, as whole non-negative counts. */
function cleanDenominations(input: unknown): Record<string, number> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const keys = new Set<string>([...NOTE_DENOMINATIONS.map((n) => n.key), COINS_KEY]);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const n = Number(value);
    if (keys.has(key) && Number.isFinite(n) && n > 0) out[key] = round2(n);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Open the till with the float the cashier counted themselves. */
export async function openDrawer(input: {
  branchId: string;
  openingFloat: number;
}): Promise<ActionResult> {
  const { staff: me } = await requireRole("OWNER", "CASHIER");

  const branch = await branchFor(me, input.branchId);
  if (!branch) return { ok: false, error: "Branch not found" };
  if (!Number.isFinite(input.openingFloat) || input.openingFloat < 0 || input.openingFloat > 100_000) {
    return { ok: false, error: "Count your opening float first" };
  }

  if (me.role === "CASHIER") {
    const row = await prisma.staff.findUnique({ where: { id: me.id }, select: { status: true } });
    if (!row || row.status === "OFF_DUTY") {
      return { ok: false, error: "Start your shift before opening the drawer" };
    }
  }

  const float = round2(input.openingFloat);
  // A float that differs from what the last close counted is worth a look.
  const last = await prisma.drawerSession.findFirst({
    where: { branchId: branch.id, closedAt: { not: null }, countedAmount: { not: null } },
    orderBy: { closedAt: "desc" },
    select: { countedAmount: true },
  });
  const diff = last ? round2(float - Number(last.countedAmount)) : 0;

  try {
    await prisma.drawerSession.create({
      data: {
        tenantId: me.tenantId,
        branchId: branch.id,
        cashierId: me.id,
        cashierName: me.name,
        openingFloat: float,
        floatMismatch: Math.abs(diff) > DRAWER_VARIANCE_TOLERANCE ? diff : null,
      },
    });
  } catch (error) {
    // `drawer_sessions_one_open_per_branch`: somebody opened it a moment ago.
    if (isUniqueViolation(error)) return { ok: false, error: "A drawer is already open" };
    throw error;
  }
  return { ok: true };
}

/** Cash in or out of the open till, with a reason. */
export async function addCashMovement(input: {
  branchId: string;
  type: "pay-in" | "pay-out";
  amount: number;
  note: string;
  category?: string;
}): Promise<ActionResult> {
  const { staff: me } = await requireRole("OWNER", "CASHIER");

  const branch = await branchFor(me, input.branchId);
  if (!branch) return { ok: false, error: "Branch not found" };
  if (input.type !== "pay-in" && input.type !== "pay-out") {
    return { ok: false, error: "Unknown cash movement" };
  }
  const amount = round2(Math.abs(Number(input.amount)));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return { ok: false, error: "Enter an amount" };
  }
  const note = clean(input.note, 200);
  if (!note) return { ok: false, error: "Pick a reason" };

  const drawer = await openDrawerAt(branch.id);
  if (!drawer) return { ok: false, error: "No open drawer" };
  if (me.role === "CASHIER" && drawer.cashierId !== me.id) {
    return { ok: false, error: `This drawer belongs to ${drawer.cashierName}` };
  }
  if (input.type === "pay-out") {
    if (me.role === "CASHIER" && amount > CASHIER_PAYOUT_LIMIT) {
      return { ok: false, error: `Cash out above RM${CASHIER_PAYOUT_LIMIT} needs the owner` };
    }
    if (amount > expectedCash(drawer)) {
      return { ok: false, error: "There isn't that much cash in the drawer" };
    }
  }

  await prisma.cashMovement.create({
    data: {
      drawerId: drawer.id,
      branchId: branch.id,
      type: input.type === "pay-in" ? "PAY_IN" : "PAY_OUT",
      amount: input.type === "pay-in" ? amount : -amount,
      note,
      category: clean(input.category, 60) || null,
      byId: me.id,
      byName: me.name,
    },
  });
  return { ok: true };
}

/**
 * Close the till from a count. The cashier is never told the expected figure
 * or the variance; the owner closes with the figure in front of them, so their
 * count is taken as it is.
 */
export async function closeDrawer(input: {
  branchId: string;
  countedAmount: number;
  denominations?: Record<string, number>;
  closingNote?: string;
}): Promise<{ result: CloseDrawerResult; message?: string }> {
  const { staff: me } = await requireRole("OWNER", "CASHIER");
  const isOwner = me.role === "OWNER";

  const branch = await branchFor(me, input.branchId);
  if (!branch) return { result: "forbidden", message: "Branch not found" };
  const drawer = await openDrawerAt(branch.id);
  if (!drawer) return { result: "forbidden", message: "No open drawer" };
  if (!isOwner && drawer.cashierId !== me.id) {
    return { result: "forbidden", message: `Only ${drawer.cashierName} can close this drawer` };
  }

  if (!isOwner) {
    const awaiting = await prisma.queueTicket.count({
      where: { branchId: branch.id, status: "AWAITING_PAYMENT" },
    });
    if (awaiting > 0) {
      return {
        result: "blocked",
        message: `${awaiting} customer${awaiting > 1 ? "s are" : " is"} still awaiting payment — take payment first`,
      };
    }
  }

  const counted = round2(Math.max(0, Number(input.countedAmount) || 0));
  const denominations = cleanDenominations(input.denominations);
  const expected = expectedCash(drawer);
  const variance = round2(counted - expected);
  const within = Math.abs(variance) <= DRAWER_VARIANCE_TOLERANCE;
  const now = new Date();
  const counts: StoredCount[] = [
    ...((drawer.counts as StoredCount[] | null) ?? []),
    { amount: counted, at: now.toISOString(), ...(denominations ? { denominations } : {}) },
  ];
  const reason = clean(input.closingNote, 500);
  const keepCount = () =>
    prisma.drawerSession.update({
      where: { id: drawer.id },
      data: { counts: counts as Prisma.InputJsonValue },
    });

  let status: "CLOSED" | "NEEDS_REVIEW" = "CLOSED";
  if (!isOwner && !within) {
    if (counts.length === 1) {
      await keepCount();
      return { result: "recount" };
    }
    if (reason.length < MIN_VARIANCE_REASON) {
      await keepCount();
      return { result: "reason-required" };
    }
    status = "NEEDS_REVIEW";
  }

  const closed = await prisma.drawerSession.updateMany({
    where: { id: drawer.id, closedAt: null },
    data: {
      closedAt: now,
      closedById: me.id,
      closedByName: me.name,
      closedByOwner: isOwner,
      countedAmount: counted,
      ...(denominations ? { denominations } : {}),
      counts: counts as Prisma.InputJsonValue,
      expectedAtClose: expected,
      variance,
      status,
      closingNote: reason || null,
      varianceReason: !within && reason ? reason : null,
    },
  });
  if (closed.count === 0) return { result: "forbidden", message: "That drawer is already closed" };

  return { result: status === "CLOSED" ? "closed" : "needs-review" };
}

/** The owner signs off a close. */
export async function reviewDrawer(drawerId: string, note: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const reviewed = await prisma.drawerSession.updateMany({
    where: { id: drawerId, tenantId: owner.tenantId, closedAt: { not: null } },
    data: {
      status: "REVIEWED",
      reviewedById: owner.id,
      reviewedByName: owner.name,
      reviewedAt: new Date(),
      reviewNote: clean(note, 500) || null,
    },
  });
  if (reviewed.count === 0) return { ok: false, error: "Drawer not found" };
  return { ok: true };
}
