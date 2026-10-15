import "server-only";

import { invoiceDto } from "@/lib/platform/dto";
import { prisma } from "@/lib/prisma";
import type { Invoice } from "@/lib/types";

/** Every tenant's invoices, newest period first — the super-admin snapshot. */
export async function invoicesFor(): Promise<Invoice[]> {
  const rows = await prisma.invoice.findMany({
    orderBy: { period: "desc" },
    include: { tenant: { select: { name: true } } },
  });
  return rows.map(invoiceDto);
}

/** One tenant's own invoices — for its owner's billing page. */
export async function invoicesForTenant(tenantId: string): Promise<Invoice[]> {
  const rows = await prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { period: "desc" },
    include: { tenant: { select: { name: true } } },
  });
  return rows.map(invoiceDto);
}
