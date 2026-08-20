import type { UserRole } from "@/lib/types";

/**
 * The shape of the session that is safe to hand to Client Components.
 *
 * Deliberately not the raw `Staff` row: that carries commission overrides,
 * targets and phone numbers, and everything passed to a client boundary is
 * serialised into the HTML. Only what the shell and the portal pages actually
 * need crosses over.
 *
 * Lives in its own module rather than in `session.ts` because that one is
 * `server-only` — a Client Component must be able to import this type.
 */
export type SessionUser = {
  authUserId: string;
  role: UserRole;
  /** Null for platform admins, who have no `staff` row. */
  staffId: string | null;
  name: string;
  email: string;
  tenantId: string | null;
  branchId: string | null;
  mustChangePassword: boolean;
};
