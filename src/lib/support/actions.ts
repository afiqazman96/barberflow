"use server";

import { redirect } from "next/navigation";

import { getSession, requirePlatformSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

import {
  clearSupportSessionCookie,
  readSupportSessionId,
  setSupportSessionCookie,
} from "./cookie";

/** How long a "viewing as support" session is allowed to run unattended. */
const SESSION_HOURS = 2;

/**
 * A platform admin starts "viewing as" a tenant's owner, for diagnosing a
 * support issue. Audited (`SupportSession`), auto-expiring, and reversible —
 * see `src/lib/auth/session.ts`'s `resolveSupportSession` for how this
 * actually takes effect on the next request.
 */
export async function startSupportSession(
  tenantId: string,
  reason?: string,
): Promise<ActionResult> {
  const { admin } = await requirePlatformSession();

  const owner = await prisma.staff.findFirst({
    where: { tenantId, role: "OWNER", active: true },
    select: { id: true },
  });
  if (!owner) {
    return { ok: false, error: "This tenant has no active owner account to view as" };
  }

  const session = await prisma.supportSession.create({
    data: {
      platformAdminId: admin.id,
      tenantId,
      staffId: owner.id,
      reason: reason?.trim() || null,
      expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  await setSupportSessionCookie(session.id);
  redirect("/owner/dashboard");
}

/**
 * Ends the active "viewing as" session. Runs from inside the impersonated
 * portal — by the time this is called, `getSession()` already resolves the
 * caller as the tenant's owner, not the platform admin — so this is gated on
 * "the cookie points at a live session", not `requirePlatformSession()`.
 */
export async function endSupportSession(): Promise<void> {
  const sessionId = await readSupportSessionId();
  if (sessionId) {
    await prisma.supportSession.updateMany({
      where: { id: sessionId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }
  await clearSupportSessionCookie();
  redirect("/super-admin/support");
}

/**
 * Called as the first line of the handful of actions too sensitive to allow
 * while impersonating (changing the owner's own password, disabling their
 * own account). Throws the same way `requireRole` does, so it fails the
 * action with a clear message rather than silently no-op'ing.
 */
export async function assertNotImpersonating(): Promise<void> {
  const session = await getSession();
  if (session?.kind === "shop" && session.impersonation) {
    throw new Error("Not allowed during a support view");
  }
}
