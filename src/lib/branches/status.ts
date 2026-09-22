import type { BranchStatus as PrismaBranchStatus } from "@/generated/prisma/enums";

import type { Branch } from "@/lib/types";

/**
 * The schema shouts its enums (`OPEN`) while the UI spells them lowercase
 * (`open`), the same split `staff/status.ts` bridges for staff. Kept as two
 * explicit switches rather than a `toLowerCase()` so a new member of either
 * enum fails to compile instead of silently mapping to something wrong.
 */
export function appBranchStatusFor(
  status: PrismaBranchStatus,
): Branch["status"] {
  switch (status) {
    case "OPEN":
      return "open";
    case "CLOSED":
      return "closed";
    case "BUSY":
      return "busy";
  }
}

export function prismaBranchStatusFor(
  status: Branch["status"],
): PrismaBranchStatus {
  switch (status) {
    case "open":
      return "OPEN";
    case "closed":
      return "CLOSED";
    case "busy":
      return "BUSY";
  }
}
