import "server-only";

import { prisma } from "@/lib/prisma";

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export type Contact = { name: string; phone: string | null; email: string | null };

/**
 * Customers are matched on phone or email rather than created per visit
 * (BACKEND_HANDOFF §4.5), so a returning walk-in keeps one CRM record.
 */
export async function resolveCustomerId(
  tenantId: string,
  contact: Contact,
  hintId?: string,
): Promise<string> {
  const find = async () => {
    if (hintId) {
      const hinted = await prisma.customer.findFirst({
        where: { id: hintId, tenantId },
        select: { id: true },
      });
      if (hinted) return hinted.id;
    }
    if (contact.phone) {
      const byPhone = await prisma.customer.findFirst({
        where: { tenantId, phone: contact.phone },
        select: { id: true },
      });
      if (byPhone) return byPhone.id;
    }
    if (contact.email) {
      const byEmail = await prisma.customer.findFirst({
        where: { tenantId, email: contact.email },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }
    return null;
  };

  const existing = await find();
  if (existing) return existing;

  try {
    const created = await prisma.customer.create({
      data: { tenantId, ...contact },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    // Two joins with the same contact raced; the other one made the record.
    if (!isUniqueViolation(error)) throw error;
    const raced = await find();
    if (raced) return raced;
    throw error;
  }
}
