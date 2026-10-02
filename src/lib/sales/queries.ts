import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { requireShopSession } from "@/lib/auth/session";
import { timezoneForTenant } from "@/lib/bookings/queries";
import { instantToShopIso } from "@/lib/bookings/time";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod, Sale } from "@/lib/types";

import { drawersAt } from "./drawer";
import type { SalesSnapshot } from "./dto";

/** This month and the two before it — what reports and commission look back over. */
const HISTORY_DAYS = 92;

const DAY_MS = 24 * 60 * 60 * 1000;

export const METHOD_FROM_PRISMA = {
  CASH: "cash",
  CARD: "card",
  QR: "qr",
} as const satisfies Record<string, PaymentMethod>;

export const saleSelect = {
  id: true,
  branchId: true,
  customerId: true,
  customerName: true,
  customerEmail: true,
  queueTicketId: true,
  staffId: true,
  staffName: true,
  receiptNo: true,
  subtotal: true,
  discount: true,
  discountReason: true,
  voucher: true,
  serviceCharge: true,
  serviceChargeRate: true,
  tax: true,
  taxRate: true,
  tip: true,
  total: true,
  paymentMethod: true,
  cardScheme: true,
  cardLast4: true,
  cardApprovalCode: true,
  commission: true,
  paidAt: true,
  rungByName: true,
  voidedAt: true,
  voidedByName: true,
  voidReason: true,
  refundPending: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      type: true,
      name: true,
      quantity: true,
      unitPrice: true,
      total: true,
    },
  },
} satisfies Prisma.SaleSelect;

type SaleRow = Prisma.SaleGetPayload<{ select: typeof saleSelect }>;

export function toSaleDto(row: SaleRow, timeZone: string): Sale {
  const card =
    row.paymentMethod === "CARD"
      ? {
          scheme: row.cardScheme ?? undefined,
          last4: row.cardLast4 ?? undefined,
          approvalCode: row.cardApprovalCode ?? undefined,
        }
      : undefined;

  return {
    id: row.id,
    branchId: row.branchId,
    customerId: row.customerId ?? "walk-in",
    customerName: row.customerName,
    customerEmail: row.customerEmail ?? undefined,
    queueTicketId: row.queueTicketId ?? undefined,
    staffId: row.staffId ?? "",
    staffName: row.staffName ?? "Retail",
    items: row.items.map((i) => ({
      id: i.id,
      type: i.type === "SERVICE" ? "service" : "product",
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    discountReason: row.discountReason ?? undefined,
    voucher: Number(row.voucher),
    tip: Number(row.tip),
    serviceCharge: Number(row.serviceCharge),
    serviceChargeRate: Number(row.serviceChargeRate),
    tax: Number(row.tax),
    taxRate: Number(row.taxRate),
    total: Number(row.total),
    paymentMethod: METHOD_FROM_PRISMA[row.paymentMethod],
    card,
    commission: Number(row.commission),
    createdAt: instantToShopIso(row.paidAt, timeZone),
    receiptNo: row.receiptNo,
    rungBy: row.rungByName ?? undefined,
    voided: row.voidedAt
      ? {
          reason: row.voidReason ?? "",
          at: instantToShopIso(row.voidedAt, timeZone),
          by: row.voidedByName ?? "",
          refundPending: row.refundPending || undefined,
        }
      : undefined,
  };
}

/**
 * Recent sales for the signed-in staff member. The owner sees every branch
 * and the counter its own; a barber sees only the sales credited to them —
 * their commission and history — without the customers' email addresses.
 * The owner and counter also get the tills (`drawer.ts`).
 */
export async function staffSalesSnapshot(): Promise<SalesSnapshot> {
  const { staff } = await requireShopSession();

  const branchIds = staff.branchId
    ? [staff.branchId]
    : (
        await prisma.branch.findMany({
          where: { tenantId: staff.tenantId },
          select: { id: true },
        })
      ).map((b) => b.id);

  const barber = staff.role === "BARBER";
  const timeZone = await timezoneForTenant(staff.tenantId);
  const rows = await prisma.sale.findMany({
    where: {
      tenantId: staff.tenantId,
      branchId: { in: branchIds },
      paidAt: { gte: new Date(Date.now() - HISTORY_DAYS * DAY_MS) },
      ...(barber ? { staffId: staff.id } : {}),
    },
    orderBy: { paidAt: "desc" },
    select: saleSelect,
  });

  const drawers = barber
    ? undefined
    : await drawersAt(staff.tenantId, branchIds, staff.role === "OWNER" ? "OWNER" : "CASHIER");

  return {
    sales: rows.map((row) => {
      const sale = toSaleDto(row, timeZone);
      return barber ? { ...sale, customerEmail: undefined } : sale;
    }),
    branchIds,
    ...(barber ? { onlyStaffId: staff.id } : {}),
    ...(drawers ? { drawers } : {}),
  };
}
