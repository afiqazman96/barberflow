import type { StaffStatus } from "@/lib/types";

/**
 * One row of the owner's staff directory, as it crosses to the client.
 *
 * Deliberately not the raw `Staff` row: that carries `authUserId`,
 * `commissionOverridePercent` and the tenant id, none of which the screen
 * needs and all of which would be serialised into the HTML. Decimals are
 * already numbers here — a Prisma `Decimal` is not serialisable across the
 * server/client boundary.
 *
 * Lives in its own module rather than in `queries.ts` because that one is
 * `server-only` — a Client Component must be able to import this type.
 */
export type StaffDirectoryEntry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** The app-side role name (`appRoleFor`), not the Prisma enum. */
  role: "owner" | "cashier" | "barber";
  /** Soft-disable flag — a disabled account cannot sign in (§5.5). */
  active: boolean;
  mustChangePassword: boolean;
  /** Null for owners, who span every branch under the tenant. */
  branchId: string | null;
  chairId: string | null;
  specialty: string | null;
  /** Last known status from the database; live status comes from the store. */
  status: StaffStatus;
  rating: number | null;
  monthlyTarget: number | null;
  avatarUrl: string | null;
};

/**
 * The places an owner can post somebody to, and the seats inside them.
 *
 * Only what the branch and chair pickers render. The store's `Branch` and
 * `Chair` carry live shop state as well — queue counts, wait times, who is
 * sitting where — which belongs to the store, not to a directory read.
 */
export type BranchOption = {
  id: string;
  name: string;
};

export type ChairOption = {
  id: string;
  branchId: string;
  label: string;
};
