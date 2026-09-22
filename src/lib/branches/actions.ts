"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";
import type { Branch } from "@/lib/types";

import { prismaBranchStatusFor } from "./status";

/**
 * Branch and chair management for the owner's Settings screen.
 *
 * As everywhere else, the tenant comes from the caller's own session row and
 * every lookup is filtered by it, so a branch id from another shop resolves to
 * "not found" rather than a cross-tenant write.
 */

/** Both owner screens render branches and chairs; keep them in step. */
function revalidateBranchScreens() {
  revalidatePath("/owner/settings");
  revalidatePath("/owner/staff");
}

type BranchInput = {
  name: string;
  address: string;
  city: string;
  phone: string;
  openHours: string;
  status: Branch["status"];
};

/** Empty text boxes are stored as null, not "" — see `BranchDetail`. */
function branchData(input: BranchInput) {
  return {
    name: input.name.trim(),
    address: input.address.trim() || null,
    city: input.city.trim() || null,
    phone: input.phone.trim() || null,
    openHours: input.openHours.trim() || null,
    status: prismaBranchStatusFor(input.status),
  };
}

/**
 * Chairs are numbered per branch (`@@unique([branchId, number])`), so the next
 * station carries on from the highest one already there rather than from the
 * count — otherwise a branch that has ever lost a chair would collide.
 */
async function nextChairNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  branchId: string,
): Promise<number> {
  const highest = await tx.chair.findFirst({
    where: { branchId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (highest?.number ?? 0) + 1;
}

/**
 * Open a new branch, with its opening row of chairs (BACKEND_HANDOFF §6.2).
 *
 * The branch and its chairs go in one transaction: a branch that was created
 * but left chairless because the second write failed would look finished on
 * the screen and take no customers.
 */
export async function createBranch(
  input: BranchInput & { chairs: number },
): Promise<ActionResult<{ branchId: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const data = branchData(input);
  if (!data.name) {
    return { ok: false, error: "Branch name is required" };
  }
  if (!Number.isInteger(input.chairs) || input.chairs < 0) {
    return { ok: false, error: "Chairs must be a whole number" };
  }

  const branchId = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.create({
      data: { ...data, tenantId: owner.tenantId },
      select: { id: true },
    });

    if (input.chairs > 0) {
      await tx.chair.createMany({
        data: Array.from({ length: input.chairs }, (_, i) => ({
          branchId: branch.id,
          number: i + 1,
          label: `Chair ${i + 1}`,
        })),
      });
    }

    return branch.id;
  });

  revalidateBranchScreens();
  return { ok: true, data: { branchId } };
}

/**
 * Save the branch editor.
 *
 * The editor's chair box is a count, while the database holds chair rows, so
 * raising it adds the missing stations — the same thing "Add Branch" does with
 * its opening count. Lowering it is refused: a chair may be occupied or carry
 * queue history, and silently deleting one to make a number match would throw
 * that away. Removing a station is a deliberate act for the Chairs tab.
 */
export async function updateBranchDetails(
  branchId: string,
  input: BranchInput & { chairs: number },
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: owner.tenantId },
    select: { id: true, _count: { select: { chairs: true } } },
  });
  if (!branch) {
    return { ok: false, error: "Branch not found" };
  }

  const data = branchData(input);
  if (!data.name) {
    return { ok: false, error: "Branch name is required" };
  }
  if (!Number.isInteger(input.chairs) || input.chairs < 0) {
    return { ok: false, error: "Chairs must be a whole number" };
  }

  const existing = branch._count.chairs;
  if (input.chairs < existing) {
    return {
      ok: false,
      error: `${data.name} already has ${existing} chairs. Remove them on the Chairs tab instead.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.branch.update({ where: { id: branchId }, data });

    const missing = input.chairs - existing;
    if (missing > 0) {
      const start = await nextChairNumber(tx, branchId);
      await tx.chair.createMany({
        data: Array.from({ length: missing }, (_, i) => ({
          branchId,
          number: start + i,
          label: `Chair ${start + i}`,
        })),
      });
    }
  });

  revalidateBranchScreens();
  return { ok: true };
}

/**
 * Add one chair to a branch. An empty label falls back to the station number,
 * which is how the rest of the shop's chairs are named.
 */
export async function createChair(
  branchId: string,
  label: string,
): Promise<ActionResult<{ chairId: string; label: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: owner.tenantId },
    select: { id: true },
  });
  if (!branch) {
    return { ok: false, error: "Branch not found" };
  }

  const chair = await prisma.$transaction(async (tx) => {
    const number = await nextChairNumber(tx, branchId);
    return tx.chair.create({
      data: {
        branchId,
        number,
        label: label.trim() || `Chair ${number}`,
      },
      select: { id: true, label: true },
    });
  });

  revalidateBranchScreens();
  return { ok: true, data: { chairId: chair.id, label: chair.label } };
}

/** Resolves a chair inside the caller's tenant, or null. */
async function findChairInTenant(chairId: string, tenantId: string) {
  return prisma.chair.findFirst({
    where: { id: chairId, branch: { tenantId } },
    select: {
      id: true,
      label: true,
      branchId: true,
      staff: { select: { id: true, name: true } },
    },
  });
}

/** Rename a station. The number is the stable identity, so it does not move. */
export async function renameChair(
  chairId: string,
  label: string,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const chair = await findChairInTenant(chairId, owner.tenantId);
  if (!chair) {
    return { ok: false, error: "Chair not found" };
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return { ok: false, error: "Chair name is required" };
  }

  await prisma.chair.update({
    where: { id: chairId },
    data: { label: trimmed },
  });

  revalidateBranchScreens();
  return { ok: true };
}

/**
 * Remove a station from a branch.
 *
 * Both foreign keys into a chair are `onDelete: SetNull`, so past tickets keep
 * their history with the chair blanked out rather than disappearing with it.
 * What the database cannot judge is the shop floor, so this refuses the two
 * cases where deleting would lose something an owner cares about: a barber
 * still seated there, and a customer currently at that chair. Both are
 * fixable in a moment — unseat the barber, finish the ticket — and neither
 * should be resolved by silently dropping the row.
 */
export async function deleteChair(chairId: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const chair = await findChairInTenant(chairId, owner.tenantId);
  if (!chair) {
    return { ok: false, error: "Chair not found" };
  }

  if (chair.staff) {
    return {
      ok: false,
      error: `${chair.staff.name} is seated here. Set the chair to Unassigned first.`,
    };
  }

  const busy = await prisma.queueTicket.count({
    where: {
      chairId,
      status: { in: ["WAITING", "CALLED", "IN_SERVICE", "AWAITING_PAYMENT"] },
    },
  });
  if (busy > 0) {
    return {
      ok: false,
      error: `${chair.label} still has a customer in the queue.`,
    };
  }

  await prisma.chair.delete({ where: { id: chairId } });

  revalidateBranchScreens();
  return { ok: true };
}
