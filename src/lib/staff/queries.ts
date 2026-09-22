import "server-only";

import { cache } from "react";

import type { StaffRole } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import type { BranchOption, ChairOption, StaffDirectoryEntry } from "./dto";
import { appStatusFor } from "./status";

/**
 * Not `appRoleFor`: that maps `BARBER` onto the *portal* name (`staff`, as in
 * /staff/dashboard). A staff record calls the same person a barber, which is
 * what the directory and the role filter show.
 */
function memberRoleFor(role: StaffRole): StaffDirectoryEntry["role"] {
  switch (role) {
    case "OWNER":
      return "owner";
    case "CASHIER":
      return "cashier";
    case "BARBER":
      return "barber";
  }
}

/**
 * Every staff member in the signed-in owner's shop (BACKEND_HANDOFF §6.2).
 *
 * Scoped to the caller's own `tenantId`, which comes from their session row —
 * never from the client — so one shop can never list another's team. The role
 * guard is here rather than only in the layout because this is the query that
 * touches the data: a layout guard protects entry into the portal, not the
 * read itself.
 *
 * `cache` dedupes it within a single render pass, so calling it from both a
 * page and a sibling component costs one round trip.
 *
 * Ordered by creation so the list reads as the team grew, with new hires
 * appended at the end rather than resorting the whole screen.
 */
export const listStaffDirectory = cache(
  async (): Promise<StaffDirectoryEntry[]> => {
    const { staff: owner } = await requireRole("OWNER");

    const rows = await prisma.staff.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        mustChangePassword: true,
        branchId: true,
        chairId: true,
        specialty: true,
        status: true,
        rating: true,
        monthlyTarget: true,
        avatarUrl: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: memberRoleFor(row.role),
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      branchId: row.branchId,
      chairId: row.chairId,
      specialty: row.specialty,
      status: appStatusFor(row.status),
      rating: row.rating === null ? null : Number(row.rating),
      monthlyTarget: row.monthlyTarget === null ? null : Number(row.monthlyTarget),
      avatarUrl: row.avatarUrl,
    }));
  },
);

/**
 * The branches in the owner's shop, and every chair in them.
 *
 * The screen's branch and chair pickers used to read the client store, which
 * meant the ids they offered were whatever that store happened to hold. The
 * write actions validate against the database, so a branch or chair that only
 * existed in the browser would be offered and then rejected. Reading both from
 * the same place the actions check removes that gap.
 *
 * Chairs come back with the branches in one round trip — they are always
 * rendered together, and the set is small enough that filtering by branch on
 * the client is cheaper than a second query per branch.
 */
export const listBranchOptions = cache(
  async (): Promise<{ branches: BranchOption[]; chairs: ChairOption[] }> => {
    const { staff: owner } = await requireRole("OWNER");

    const rows = await prisma.branch.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        chairs: {
          orderBy: { number: "asc" },
          select: { id: true, branchId: true, label: true },
        },
      },
    });

    return {
      branches: rows.map(({ id, name }) => ({ id, name })),
      chairs: rows.flatMap((branch) => branch.chairs),
    };
  },
);
