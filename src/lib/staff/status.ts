import type { StaffStatus as PrismaStaffStatus } from "@/generated/prisma/enums";
import type { StaffStatus } from "@/lib/types";

/**
 * The domain enum spells statuses `OFF_DUTY`; the UI spells them `off-duty`.
 * These two functions are the only place that gap is bridged.
 *
 * Pure and dependency-free, like `auth/roles.ts`, so the query module, the
 * actions and any Client Component can all share one mapping.
 */
export function appStatusFor(status: PrismaStaffStatus): StaffStatus {
  switch (status) {
    case "OFF_DUTY":
      return "off-duty";
    case "AVAILABLE":
      return "available";
    case "BUSY":
      return "busy";
    case "BREAK":
      return "break";
  }
}

export function prismaStatusFor(status: StaffStatus): PrismaStaffStatus {
  switch (status) {
    case "off-duty":
      return "OFF_DUTY";
    case "available":
      return "AVAILABLE";
    case "busy":
      return "BUSY";
    case "break":
      return "BREAK";
  }
}
