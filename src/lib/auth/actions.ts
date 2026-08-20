"use server";

import { revalidatePath } from "next/cache";

import type { StaffRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { SessionUser } from "./dto";
import { appRoleFor } from "./roles";
import { getAuthUser, requireRole } from "./session";
import type { ActionResult } from "./types";

/**
 * Sign in with email + password (BACKEND_HANDOFF §7 `POST /auth/login`).
 *
 * Supabase verifies the credentials; we then confirm a domain row exists and
 * is active. A disabled staff member must not keep a valid session, so we sign
 * them straight back out rather than leaving a token that resolves to null on
 * every subsequent request.
 *
 * Returns the same `SessionUser` DTO the server guards produce, so the login
 * screen can hydrate the client store and route without a second round trip.
 * It deliberately does not redirect: the caller decides where to go, and a
 * `redirect()` here would make the failure cases awkward to surface.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult<SessionUser>> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" tells an attacker which emails are registered.
    return { ok: false, error: "Incorrect email or password" };
  }

  const staff = await prisma.staff.findUnique({
    where: { authUserId: data.user.id },
  });

  if (staff) {
    if (!staff.active) {
      await supabase.auth.signOut();
      return { ok: false, error: "This account has been disabled" };
    }
    await prisma.staff.update({
      where: { authUserId: data.user.id },
      data: { lastLoginAt: new Date() },
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: {
        authUserId: data.user.id,
        role: appRoleFor(staff.role),
        staffId: staff.id,
        name: staff.name,
        email: staff.email,
        tenantId: staff.tenantId,
        branchId: staff.branchId,
        mustChangePassword: staff.mustChangePassword,
      },
    };
  }

  const admin = await prisma.platformAdmin.findUnique({
    where: { authUserId: data.user.id },
  });

  if (admin?.active) {
    revalidatePath("/", "layout");
    return {
      ok: true,
      data: {
        authUserId: data.user.id,
        role: "super-admin",
        staffId: null,
        name: admin.name,
        email: admin.email,
        tenantId: null,
        branchId: null,
        mustChangePassword: false,
      },
    };
  }

  // Authenticated with Supabase but not linked to any shop or platform row.
  await supabase.auth.signOut();
  return { ok: false, error: "This account is not linked to a shop" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

/**
 * Change your own password (BACKEND_HANDOFF §7 `POST /auth/change-password`).
 * Clears `mustChangePassword`, which is what gates the forced-change screen
 * after an owner hands out a temp password (§6.2).
 *
 * Supabase's `updateUser` does not check the old password — a stolen session
 * could otherwise be used to lock the real owner out of their own account — so
 * re-authenticate with the current one first. That call also refreshes the
 * session cookies, which is harmless here.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const user = await getAuthUser();
  if (!user?.email) {
    return { ok: false, error: "You are not signed in" };
  }

  if (newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters" };
  }

  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { ok: false, error: "Current password is incorrect" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message };
  }

  await prisma.staff.updateMany({
    where: { authUserId: user.id },
    data: { mustChangePassword: false },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Owner provisions a staff member (BACKEND_HANDOFF §6.2).
 *
 * Creates the Supabase Auth user and the `staff` row together. The auth user is
 * created first because it is the thing that can fail on a duplicate email —
 * and if the Prisma insert then fails, we delete the auth user so a retry is
 * not blocked by a half-created account.
 *
 * Note: `tenantId` comes from the caller's own session, never from the client.
 */
export async function createStaff(input: {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  branchId: string | null;
  temporaryPassword: string;
  mustChangePassword?: boolean;
}): Promise<ActionResult<{ staffId: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const email = input.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.temporaryPassword,
    // The owner vouches for the address; there is no inbox to click through.
    email_confirm: true,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: error?.message ?? "Could not create the login for this staff member",
    };
  }

  try {
    const staff = await prisma.staff.create({
      data: {
        tenantId: owner.tenantId,
        branchId: input.branchId,
        name: input.name,
        email,
        phone: input.phone,
        role: input.role,
        authUserId: data.user.id,
        mustChangePassword: input.mustChangePassword ?? true,
      },
      select: { id: true },
    });

    revalidatePath("/owner/settings");
    return { ok: true, data: { staffId: staff.id } };
  } catch (cause) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw cause;
  }
}

/**
 * Owner resets a staff member's password (BACKEND_HANDOFF §6.2). Scoped to the
 * owner's own tenant — the lookup filters on `tenantId`, so an id from another
 * shop simply does not resolve.
 */
export async function resetStaffPassword(
  staffId: string,
  temporaryPassword: string,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await prisma.staff.findFirst({
    where: { id: staffId, tenantId: owner.tenantId },
    select: { authUserId: true },
  });

  if (!target?.authUserId) {
    return { ok: false, error: "Staff member not found" };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(target.authUserId, {
    password: temporaryPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { mustChangePassword: true },
  });

  revalidatePath("/owner/settings");
  return { ok: true };
}

/**
 * Soft-disable or re-enable a staff account (BACKEND_HANDOFF §5.5). We also ban
 * the Supabase user when disabling, so any session they already hold stops
 * refreshing instead of staying live until it expires.
 */
export async function setStaffActive(
  staffId: string,
  active: boolean,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await prisma.staff.findFirst({
    where: { id: staffId, tenantId: owner.tenantId },
    select: { id: true, authUserId: true },
  });

  if (!target) {
    return { ok: false, error: "Staff member not found" };
  }

  if (target.authUserId) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(target.authUserId, {
      // "none" lifts the ban; Supabase expects a duration string.
      ban_duration: active ? "none" : "876000h",
    });
  }

  await prisma.staff.update({ where: { id: staffId }, data: { active } });

  revalidatePath("/owner/settings");
  return { ok: true };
}
