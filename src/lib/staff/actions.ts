"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";
import type { StaffStatus } from "@/lib/types";

import { prismaStatusFor } from "./status";

/**
 * The owner-side staff operations that are not about credentials — those live
 * in `auth/actions.ts`, next to the Supabase admin client they need.
 *
 * Every action here resolves the caller's own session and scopes the write to
 * their `tenantId`. A staff id from another shop simply does not resolve, so
 * the failure is "not found" rather than a cross-tenant write.
 */

/** Both owner staff screens read the team; keep them in step after a write. */
function revalidateStaffScreens() {
  revalidatePath("/owner/staff");
  revalidatePath("/owner/settings");
}

/** Resolves a staff member inside the caller's tenant, or null. */
async function findInTenant(staffId: string, tenantId: string) {
  return prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      branchId: true,
      chairId: true,
      status: true,
    },
  });
}

/**
 * Owner moves a staff member between `available` and `break`.
 *
 * Deliberately not a general status setter. Going on or off duty is a
 * clock-in/clock-out by the staff member themselves (or an override on the
 * Roster screen), and `busy` is a consequence of a running service — so an
 * owner may only nudge somebody who is already clocked in. The screen disables
 * the other options; this is the same rule where it cannot be bypassed.
 */
export async function setStaffStatus(
  staffId: string,
  status: Extract<StaffStatus, "available" | "break">,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await findInTenant(staffId, owner.tenantId);
  if (!target) {
    return { ok: false, error: "Staff member not found" };
  }
  if (!target.active) {
    return { ok: false, error: "This account is disabled" };
  }
  if (target.status === "OFF_DUTY") {
    return { ok: false, error: `${target.name} has not clocked in yet` };
  }
  if (target.status === "BUSY") {
    return { ok: false, error: `${target.name} is in service` };
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { status: prismaStatusFor(status) },
  });

  revalidateStaffScreens();
  return { ok: true };
}

/**
 * Seat a barber at a chair, or clear their seat when `chairId` is null.
 *
 * `Staff.chairId` is unique, so a chair somebody else is already sitting at
 * has to be freed in the same transaction — otherwise the update trips the
 * constraint. Taking an occupied chair therefore moves the previous occupant
 * off it, which is what the screen's chair picker has always done.
 */
export async function assignStaffChair(
  staffId: string,
  chairId: string | null,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await findInTenant(staffId, owner.tenantId);
  if (!target) {
    return { ok: false, error: "Staff member not found" };
  }

  if (chairId === null) {
    await prisma.staff.update({
      where: { id: staffId },
      data: { chairId: null },
    });
    revalidateStaffScreens();
    return { ok: true };
  }

  if (target.role !== "BARBER") {
    return { ok: false, error: "Only barbers are assigned a chair" };
  }

  const chair = await prisma.chair.findFirst({
    where: { id: chairId, branch: { tenantId: owner.tenantId } },
    select: { id: true, branchId: true, label: true },
  });
  if (!chair) {
    return { ok: false, error: "Chair not found" };
  }
  if (chair.branchId !== target.branchId) {
    return {
      ok: false,
      error: `${chair.label} is at another branch`,
    };
  }

  await prisma.$transaction([
    // Free the chair first: the unique index is checked per statement, so
    // setting it on two rows at once would fail even inside a transaction.
    prisma.staff.updateMany({
      where: { chairId, tenantId: owner.tenantId },
      data: { chairId: null },
    }),
    prisma.staff.update({ where: { id: staffId }, data: { chairId } }),
  ]);

  revalidateStaffScreens();
  return { ok: true };
}

/**
 * Edit the details an owner captured when they added somebody.
 *
 * Credentials are not here: the email is the Supabase Auth key for the
 * account, so changing it is an auth operation rather than a profile edit, and
 * the password has its own reset action. Role is left out too — it decides
 * which portal the person lands in and whether a chair applies to them at all,
 * which is a bigger change than correcting a phone number.
 *
 * Empty optional fields are stored as null rather than "", so "not recorded"
 * reads the same whether the owner never filled it in or cleared it later.
 */
export async function updateStaffProfile(
  staffId: string,
  input: {
    name: string;
    phone: string;
    specialty: string;
    monthlyTarget: number | null;
  },
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await findInTenant(staffId, owner.tenantId);
  if (!target) {
    return { ok: false, error: "Staff member not found" };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const { monthlyTarget } = input;
  if (
    monthlyTarget !== null &&
    (!Number.isFinite(monthlyTarget) || monthlyTarget < 0)
  ) {
    return { ok: false, error: "Monthly target must be zero or more" };
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: {
      name,
      phone: input.phone.trim() || null,
      specialty: input.specialty.trim() || null,
      monthlyTarget,
    },
  });

  revalidateStaffScreens();
  return { ok: true };
}

/**
 * Transfer a staff member to another branch (BACKEND_HANDOFF §6.2).
 *
 * Their chair is cleared in the same write: chairs belong to a branch, so
 * carrying one across would leave them seated somewhere they no longer work.
 */
export async function transferStaffBranch(
  staffId: string,
  branchId: string,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const target = await findInTenant(staffId, owner.tenantId);
  if (!target) {
    return { ok: false, error: "Staff member not found" };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: owner.tenantId },
    select: { id: true },
  });
  if (!branch) {
    return { ok: false, error: "Branch not found" };
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { branchId, chairId: null },
  });

  revalidateStaffScreens();
  return { ok: true };
}
