"use server";

import type { Prisma } from "@/generated/prisma/client";
import { requireShopSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

/**
 * Every write to notifications. The three `notify*` helpers are called from
 * other domains' own actions (ticket updates, stock changes, new bookings) —
 * never a client. They swallow their own errors: a notification failing to
 * write must never roll back or fail the write that triggered it.
 *
 * A "use server" file may only export async functions — constants live in
 * `./constants.ts` instead.
 */

type Client = typeof prisma | Prisma.TransactionClient;

export async function notifyTicketStatusChanged(
  ticket: { tenantId: string; subject: string; status: string },
  client: Client = prisma,
): Promise<void> {
  try {
    await client.notification.create({
      data: {
        tenantId: ticket.tenantId,
        type: "TICKET_STATUS_CHANGED",
        title: "Ticket updated",
        body: `"${ticket.subject}" is now ${ticket.status}`,
        visibleToRoles: ["OWNER"],
      },
    });
  } catch {
    // Best-effort — the ticket status change itself already succeeded.
  }
}

/** Only fires when stock just crossed at/under the threshold, not every decrement while already low. */
export async function notifyLowStock(
  product: { tenantId: string; name: string; stock: number },
  client: Client = prisma,
): Promise<void> {
  try {
    await client.notification.create({
      data: {
        tenantId: product.tenantId,
        type: "LOW_STOCK",
        title: "Low stock",
        body: `${product.name} is down to ${product.stock} left`,
        visibleToRoles: ["OWNER"],
      },
    });
  } catch {
    // Best-effort.
  }
}

export async function notifyNewBooking(
  booking: { tenantId: string; branchId: string; customerName: string; time: string },
  client: Client = prisma,
): Promise<void> {
  try {
    await client.notification.create({
      data: {
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        type: "NEW_BOOKING",
        title: "New appointment",
        body: `${booking.customerName} booked for ${booking.time}`,
        visibleToRoles: ["OWNER", "CASHIER"],
      },
    });
  } catch {
    // Best-effort.
  }
}

export async function notifyInvoiceDue(
  invoice: { tenantId: string; amount: number; dueAt: Date },
  client: Client = prisma,
): Promise<void> {
  try {
    await client.notification.create({
      data: {
        tenantId: invoice.tenantId,
        type: "INVOICE_DUE",
        title: "Invoice issued",
        body: `RM${invoice.amount.toFixed(2)} due by ${invoice.dueAt.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}`,
        visibleToRoles: ["OWNER"],
      },
    });
  } catch {
    // Best-effort.
  }
}

/** Opening the bell calls this — resets the unread cursor to now. */
export async function markNotificationsSeen(): Promise<ActionResult> {
  const { staff } = await requireShopSession();
  await prisma.staff.update({
    where: { id: staff.id },
    data: { notificationsSeenAt: new Date() },
  });
  return { ok: true };
}
