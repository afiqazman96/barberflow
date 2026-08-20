import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { PlatformAdmin, Staff } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

import type { SessionUser } from "./dto";
import { appRoleFor, homeRouteFor } from "./roles";

export type { SessionUser };

/**
 * The bridge between Supabase Auth and the domain model.
 *
 * Supabase owns credentials and hands us a verified `auth.users.id`. Everything
 * the app actually authorises on — role, tenantId, branchId — lives in our own
 * `staff` / `platform_admins` tables, keyed by that id. Nothing in this module
 * trusts a client-supplied tenantId.
 */

export type ShopSession = {
  kind: "shop";
  authUserId: string;
  staff: Staff;
};

export type PlatformSession = {
  kind: "platform";
  authUserId: string;
  admin: PlatformAdmin;
};

export type Session = ShopSession | PlatformSession;

/**
 * The verified Supabase user for this request, or null.
 *
 * `cache` dedupes this across a single render pass, so a layout and the pages
 * beneath it share one round trip.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  // getUser() verifies the token with Supabase. getSession() only decodes the
  // cookie, which a client could forge — never authorise on it.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Resolves the signed-in user to their domain row. Returns null when nobody is
 * signed in, when no row is linked to the auth user, or when the account has
 * been soft-disabled (`active = false`, BACKEND_HANDOFF §5.5).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const staff = await prisma.staff.findUnique({
    where: { authUserId: user.id },
  });
  if (staff) {
    return staff.active
      ? { kind: "shop", authUserId: user.id, staff }
      : null;
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { authUserId: user.id },
  });
  if (admin) {
    return admin.active
      ? { kind: "platform", authUserId: user.id, admin }
      : null;
  }

  return null;
});

/**
 * Use in any shop-scoped Server Component, Server Action or Route Handler that
 * must not run for an anonymous or platform-only caller. The returned
 * `staff.tenantId` is the only tenant id that should ever reach a query.
 */
export async function requireShopSession(): Promise<ShopSession> {
  const session = await getSession();
  if (session?.kind !== "shop") {
    throw new Error("Unauthorized: shop session required");
  }
  return session;
}

/** Same, for the Super Admin console at /platform. */
export async function requirePlatformSession(): Promise<PlatformSession> {
  const session = await getSession();
  if (session?.kind !== "platform") {
    throw new Error("Unauthorized: platform session required");
  }
  return session;
}

/** Narrows a shop session to specific roles (BACKEND_HANDOFF §4). */
export async function requireRole(
  ...roles: Staff["role"][]
): Promise<ShopSession> {
  const session = await requireShopSession();
  if (!roles.includes(session.staff.role)) {
    throw new Error(
      `Unauthorized: requires ${roles.join(" or ")}, got ${session.staff.role}`,
    );
  }
  return session;
}

/** The signed-in user as a client-safe DTO, or null when nobody is signed in. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session) return null;

  if (session.kind === "platform") {
    const { admin } = session;
    return {
      authUserId: session.authUserId,
      role: "super-admin",
      staffId: null,
      name: admin.name,
      email: admin.email,
      tenantId: null,
      branchId: null,
      mustChangePassword: false,
    };
  }

  const { staff } = session;
  return {
    authUserId: session.authUserId,
    role: appRoleFor(staff.role),
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    tenantId: staff.tenantId,
    branchId: staff.branchId,
    mustChangePassword: staff.mustChangePassword,
  };
});

/**
 * Route guard for a portal's layout: the caller must be signed in *and* hold
 * the role that portal is for.
 *
 * Anonymous visitors go to the login screen; a signed-in user who wandered
 * into the wrong portal is sent to their own — bouncing them to `/` would look
 * like being logged out.
 *
 * Note that a layout only re-renders when the segment is entered, so this
 * guards entry into the portal rather than every navigation inside it. That is
 * sufficient because every route under one portal requires the same role; any
 * check on the *data* still belongs in the action or query that touches it.
 */
export async function requirePortal(portal: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }
  if (user.role !== portal) {
    redirect(homeRouteFor(user.role));
  }

  return user;
}

/** For the two login screens: send an already-signed-in visitor to their portal. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    redirect(homeRouteFor(user.role));
  }
}
