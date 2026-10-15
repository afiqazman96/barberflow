"use server";

import { requirePlatformSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { isUniqueViolation } from "@/lib/customers/resolve";
import { notifyInvoiceDue } from "@/lib/notifications/actions";
import { activateTenant, suspendTenantRow } from "@/lib/platform/actions";
import { invoiceDto } from "@/lib/platform/dto";
import { prisma } from "@/lib/prisma";
import { dateColumn } from "@/lib/shop/queries";
import { shopTimeToInstant } from "@/lib/bookings/time";
import type { Invoice } from "@/lib/types";

/**
 * The billing cron's two steps. Both are cron-only — not session-gated,
 * since the only caller is `src/app/api/cron/billing/route.ts`, which
 * authorises on `CRON_SECRET` instead (a cron invocation has no browser
 * session to check). `markInvoicePaid` below is the one admin-facing,
 * session-gated action in this module.
 */

const TIMEZONE = "Asia/Kuala_Lumpur";

function firstOfMonth(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

/**
 * Creates this month's invoice for every ACTIVE, non-archived tenant — a
 * no-op on every day but the 1st, and a no-op for any tenant that already
 * has one for this period (the `@@unique([tenantId, period])` constraint
 * makes a retried or caught-up-after-a-missed-day run safe: a duplicate
 * create just fails with P2002 and is skipped, not treated as an error).
 */
export async function generateMonthlyInvoices(
  today: string,
): Promise<{ created: number }> {
  if (Number(today.slice(8, 10)) !== 1) return { created: 0 };

  const period = dateColumn(firstOfMonth(today));
  const dueAt = shopTimeToInstant(`${today.slice(0, 8)}07`, "00:00", TIMEZONE);
  if (!dueAt) return { created: 0 };

  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE", archived: false },
    select: { id: true, mrr: true },
  });

  let created = 0;
  for (const tenant of tenants) {
    try {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          period,
          amount: tenant.mrr,
          dueAt,
        },
      });
      created += 1;
      await notifyInvoiceDue({
        tenantId: tenant.id,
        amount: Number(tenant.mrr),
        dueAt: invoice.dueAt,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Already has an invoice for this period — fine, skip.
    }
  }
  return { created };
}

/**
 * Finds every invoice whose due date has passed and is still unpaid, marks
 * it overdue, and suspends the tenant if it's still ACTIVE (a tenant
 * already SUSPENDED/TRIAL/archived is left alone). Self-gating by
 * construction — no date-of-month check needed, "has dueAt passed" is
 * always correct regardless of which day the cron happens to run.
 */
export async function processOverdueInvoices(
  today: string,
): Promise<{ markedOverdue: number; suspended: number }> {
  void today; // kept for symmetry with generateMonthlyInvoices's signature

  const overdue = await prisma.invoice.findMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    select: { id: true, tenantId: true, tenant: { select: { status: true } } },
  });

  let suspended = 0;
  for (const invoice of overdue) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "OVERDUE" },
    });
    if (invoice.tenant.status === "ACTIVE") {
      await suspendTenantRow(invoice.tenantId);
      suspended += 1;
    }
  }
  return { markedOverdue: overdue.length, suspended };
}

/**
 * The admin confirms payment was received (bank transfer, etc. — there is
 * no payment gateway here, this is a bookkeeping action). Reactivates the
 * tenant if it's currently suspended — there's only one path to SUSPENDED
 * in this codebase (manual or this invoice flow), so there's no "wrong
 * reason" to guard against.
 */
export async function markInvoicePaid(invoiceId: string): Promise<ActionResult<{ invoice: Invoice }>> {
  await requirePlatformSession();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: { select: { status: true, name: true } } },
  });
  if (!invoice) return { ok: false, error: "Invoice not found" };

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt: new Date() },
    include: { tenant: { select: { name: true } } },
  });

  if (invoice.tenant.status === "SUSPENDED") {
    await activateTenant(invoice.tenantId);
  }

  return { ok: true, data: { invoice: invoiceDto(updated) } };
}
