import "server-only";

import { cache } from "react";

import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import type { BranchDetail, ChairDetail } from "./dto";
import { appBranchStatusFor } from "./status";

/**
 * Every branch in the signed-in owner's shop, with its chairs and whoever is
 * seated at them (BACKEND_HANDOFF §6.2).
 *
 * Scoped to the caller's own `tenantId`, taken from their session row rather
 * than the client. Branches are ordered by creation and chairs by station
 * number, which is the order both lists have always been rendered in.
 */
export const listBranchDetails = cache(
  async (): Promise<{ branches: BranchDetail[]; chairs: ChairDetail[] }> => {
    const { staff: owner } = await requireRole("OWNER");

    const rows = await prisma.branch.findMany({
      where: { tenantId: owner.tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        openHours: true,
        status: true,
        chairs: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            branchId: true,
            number: true,
            label: true,
            // The unique side lives on `Staff.chairId`, so the occupant comes
            // back through the relation rather than a column on the chair.
            staff: { select: { id: true } },
          },
        },
      },
    });

    return {
      branches: rows.map((branch) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address ?? "",
        city: branch.city ?? "",
        phone: branch.phone ?? "",
        openHours: branch.openHours ?? "",
        status: appBranchStatusFor(branch.status),
        chairs: branch.chairs.length,
      })),
      chairs: rows.flatMap((branch) =>
        branch.chairs.map(({ staff, ...chair }) => ({
          ...chair,
          staffId: staff?.id ?? null,
        })),
      ),
    };
  },
);
