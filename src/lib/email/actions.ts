"use server";

import { headers } from "next/headers";

import { requirePlatformSession, requireRole, requireShopSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/public-origin";

import { sendEmail } from "./resend";
import { receipt, staffWelcome, tenantWelcome } from "./templates";
import type {
  EmailResult,
  ReceiptEmailInput,
  StaffWelcomeInput,
  TenantWelcomeInput,
} from "./types";

/**
 * Transactional email: a new tenant's owner login, a new staff login, and a
 * customer's receipt.
 *
 * These are callable from the browser, so each one is written so it cannot be
 * turned into a way to send arbitrary mail:
 *   - the caller must hold the right session (platform admin, owner, or
 *     owner/cashier);
 *   - the wording is fixed by the templates — callers supply values, never
 *     markup;
 *   - a staff login goes only to the address stored for that staff member in
 *     the caller's own shop, looked up here rather than taken from the client;
 *   - the sign-in link is built here, not passed in.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1_000_000
    ? Math.round(value * 100) / 100
    : null;
}

/** Where a new user signs in — the configured public site, else this request's host. */
async function loginUrl(): Promise<string> {
  const fixed = publicOrigin();
  if (fixed) return `${fixed}/`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}/`;
}

const DENIED: EmailResult = { ok: false, error: "You don't have permission to send this email" };

/** Super Admin → the owner of a newly created tenant. */
export async function emailTenantOwnerWelcome(
  input: TenantWelcomeInput,
): Promise<EmailResult> {
  try {
    await requirePlatformSession();
  } catch {
    return DENIED;
  }

  const to = clean(input.ownerEmail, 200).toLowerCase();
  const tempPassword = clean(input.tempPassword, 100);
  const businessName = clean(input.businessName, 120);
  if (!EMAIL_RE.test(to) || !tempPassword || !businessName) {
    return { ok: false, error: "Owner email, shop name and password are required" };
  }

  const content = tenantWelcome({
    ownerName: clean(input.ownerName, 120),
    businessName,
    plan: clean(input.plan, 60) || "BarberFlow",
    trialEndsAt: clean(input.trialEndsAt, 40) || undefined,
    loginUrl: await loginUrl(),
    email: to,
    tempPassword,
  });
  return sendEmail({ to, ...content });
}

const ROLE_LABEL = { OWNER: "an owner", CASHIER: "a cashier", BARBER: "a barber" } as const;

/** Owner → a staff member they just added (or re-issued a password for). */
export async function emailStaffWelcome(input: StaffWelcomeInput): Promise<EmailResult> {
  let ownerTenantId: string;
  try {
    ownerTenantId = (await requireRole("OWNER")).staff.tenantId;
  } catch {
    return DENIED;
  }

  const tempPassword = clean(input.tempPassword, 100);
  if (!tempPassword) return { ok: false, error: "A temporary password is required" };

  // The recipient is whatever address is on file for this person in this shop.
  const member = await prisma.staff.findFirst({
    where: { id: clean(input.staffId, 64), tenantId: ownerTenantId },
    select: {
      name: true,
      email: true,
      role: true,
      branch: { select: { name: true } },
      tenant: { select: { name: true } },
    },
  });
  if (!member) return { ok: false, error: "Staff member not found" };

  const content = staffWelcome({
    name: member.name,
    businessName: member.tenant.name,
    roleLabel: ROLE_LABEL[member.role],
    branchName: member.branch?.name,
    loginUrl: await loginUrl(),
    email: member.email,
    tempPassword,
    mustChangePassword: !!input.mustChangePassword,
  });
  return sendEmail({ to: member.email, ...content });
}

const PAYMENT_LABELS = new Set(["Cash", "Card", "QR Pay"]);

/** Counter → a customer's receipt. */
export async function emailReceipt(input: ReceiptEmailInput): Promise<EmailResult> {
  try {
    const { staff } = await requireShopSession();
    if (staff.role !== "OWNER" && staff.role !== "CASHIER") return DENIED;
  } catch {
    return DENIED;
  }

  const to = clean(input.to, 200).toLowerCase();
  if (!EMAIL_RE.test(to)) return { ok: false, error: "Enter a valid email address" };

  const items = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
  const cleanItems = [];
  for (const i of items) {
    const unitPrice = money(i?.unitPrice);
    const total = money(i?.total);
    const quantity = Number.isInteger(i?.quantity) && i.quantity > 0 && i.quantity < 1000 ? i.quantity : null;
    const name = clean(i?.name, 120);
    if (!name || unitPrice === null || total === null || quantity === null) {
      return { ok: false, error: "This receipt has an item we can't send" };
    }
    cleanItems.push({ name, quantity, unitPrice, total });
  }
  if (cleanItems.length === 0) return { ok: false, error: "This receipt has no items" };

  const subtotal = money(input.subtotal);
  const total = money(input.total);
  const discount = money(input.discount);
  const tip = money(input.tip);
  if (subtotal === null || total === null || discount === null || tip === null) {
    return { ok: false, error: "This receipt has an amount we can't send" };
  }

  const receiptNo = clean(input.receiptNo, 40);
  const paymentLabel = PAYMENT_LABELS.has(input.paymentLabel) ? input.paymentLabel : "Other";
  const content = receipt({
    to,
    shopName: clean(input.shopName, 120) || "BarberFlow",
    address: clean(input.address, 200) || undefined,
    phone: clean(input.phone, 40) || undefined,
    receiptNo,
    dateLabel: clean(input.dateLabel, 60),
    customerName: clean(input.customerName, 120) || "Customer",
    barberName: clean(input.barberName, 120) || undefined,
    items: cleanItems,
    subtotal,
    discount,
    discountReason: clean(input.discountReason, 80) || undefined,
    serviceCharge: money(input.serviceCharge) ?? undefined,
    serviceChargeRate: money(input.serviceChargeRate) ?? undefined,
    tax: money(input.tax) ?? undefined,
    taxRate: money(input.taxRate) ?? undefined,
    tip,
    total,
    paymentLabel,
    cardLast4: /^\d{4}$/.test(clean(input.cardLast4, 4)) ? clean(input.cardLast4, 4) : undefined,
  });

  return sendEmail({
    to,
    ...content,
    // Automatic sends at checkout can fire twice (double render, retry); a
    // person pressing "Email receipt" again means it, so that has no key.
    idempotencyKey: input.auto ? `receipt-${receiptNo}-${to}-${total}` : undefined,
  });
}
