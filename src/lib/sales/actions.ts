"use server";

import type { PaymentMethod as PrismaPaymentMethod } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { timezoneForTenant } from "@/lib/bookings/queries";
import { calcCommission } from "@/lib/commission";
import { isUniqueViolation } from "@/lib/customers/resolve";
import { CASHIER_DISCOUNT_CAP_PCT, computeCharges } from "@/lib/pos-pricing";
import { prisma } from "@/lib/prisma";
import { commissionRulesFor, taxConfigFor } from "@/lib/shop/queries";
import type { PaymentMethod, PosItem } from "@/lib/types";

import type { CheckoutInput, CheckoutResult } from "./dto";
import { saleSelect, toSaleDto } from "./queries";

/**
 * Taking payment, and voiding it.
 *
 * The browser says what is on the bill; everything with money in it is worked
 * out again here — line prices from the catalogue, service charge and SST from
 * the shop's settings, commission from its rules — so a tampered request can
 * neither undercharge nor pay a barber more than the rules say (§8).
 *
 * Nothing here publishes to Realtime: triggers on `sales`, `queue_tickets` and
 * `bookings` poke the branch for every committed write.
 */

const METHOD_TO_PRISMA = {
  cash: "CASH",
  card: "CARD",
  qr: "QR",
} as const satisfies Record<PaymentMethod, PrismaPaymentMethod>;

const MAX_QUANTITY = 99;
const MAX_TIP = 10_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const round2 = (n: number) => Math.round(n * 100) / 100;
const samePrice = (a: number, b: number) => Math.abs(a - b) < 0.005;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** "Fade House KL" → "FHKL": short words kept whole, long ones by initial. */
function receiptPrefix(branchName: string): string {
  const code = branchName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w : w[0]))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return code || "R";
}

/** Raised inside the transaction when the ticket was settled a moment ago. */
class AlreadySettled extends Error {}

/** Raised inside the transaction when the till closed a moment ago. */
class NoDrawer extends Error {}

const NO_DRAWER = "Open the cash drawer before taking cash";

/** Take payment for a bill, settling the ticket it came from. */
export async function checkout(input: CheckoutInput): Promise<CheckoutResult> {
  const { staff: me } = await requireRole("OWNER", "CASHIER");
  const tenantId = me.tenantId;

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, tenantId },
    select: { id: true, name: true },
  });
  if (!branch || (me.branchId && me.branchId !== branch.id)) {
    return { ok: false, error: "Branch not found" };
  }

  const method = METHOD_TO_PRISMA[input.method];
  if (!method) return { ok: false, error: "Pick a payment method" };
  const idempotencyKey = clean(input.idempotencyKey, 100);
  if (!idempotencyKey) return { ok: false, error: "Missing checkout key" };

  const timeZone = await timezoneForTenant(tenantId);

  // A retry after a dropped connection: hand back the sale already made.
  const earlier = await prisma.sale.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    select: saleSelect,
  });
  if (earlier) return { ok: true, sale: toSaleDto(earlier, timeZone) };

  // Cash goes into a till, so there has to be one open at this branch.
  if (
    method === "CASH" &&
    (await prisma.drawerSession.count({ where: { branchId: branch.id, closedAt: null } })) === 0
  ) {
    return { ok: false, error: NO_DRAWER };
  }

  // ---- What is on the bill, priced from the catalogue ----------------------

  const quantities = new Map<string, { type: "service" | "product"; quantity: number; unitPrice: number }>();
  for (const item of input.items ?? []) {
    if (item.type !== "service" && item.type !== "product") {
      return { ok: false, error: "Unknown item on the bill" };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return { ok: false, error: "Check the quantities on the bill" };
    }
    const key = `${item.type}:${item.id}`;
    const seen = quantities.get(key);
    quantities.set(key, {
      type: item.type,
      quantity: (seen?.quantity ?? 0) + item.quantity,
      unitPrice: item.unitPrice,
    });
  }

  const ids = (type: "service" | "product") =>
    [...quantities.entries()].filter(([, l]) => l.type === type).map(([k]) => k.split(":")[1]);
  const [services, products, plan] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: ids("service") }, tenantId, active: true },
      select: { id: true, name: true, price: true, membershipPrice: true },
    }),
    prisma.product.findMany({
      where: { id: { in: ids("product") }, tenantId, active: true },
      select: { id: true, name: true, price: true },
    }),
    input.membershipPlanId
      ? prisma.membershipPlan.findFirst({
          where: { id: input.membershipPlanId, tenantId, active: true },
          select: { id: true, name: true, tier: true, price: true },
        })
      : null,
  ]);
  if (input.membershipPlanId && !plan) {
    return { ok: false, error: "That membership plan is no longer offered" };
  }

  const lines: PosItem[] = [];
  for (const [key, line] of quantities) {
    const id = key.split(":")[1];
    const entry =
      line.type === "service"
        ? services.find((s) => s.id === id)
        : products.find((p) => p.id === id);
    if (!entry) return { ok: false, error: "Something on the bill is no longer sold" };

    // The member price is the only other price a line may carry.
    const allowed = [Number(entry.price)];
    if ("membershipPrice" in entry) allowed.push(Number(entry.membershipPrice));
    if (!allowed.some((p) => samePrice(p, line.unitPrice))) {
      return { ok: false, error: `The price of ${entry.name} has changed — reload the POS` };
    }
    lines.push({
      id,
      type: line.type,
      name: entry.name,
      quantity: line.quantity,
      unitPrice: round2(line.unitPrice),
    });
  }
  if (lines.length === 0 && !plan) return { ok: false, error: "There is nothing to charge" };

  // ---- Whose bill, and who is credited --------------------------------------

  const ticket = input.ticketId
    ? await prisma.queueTicket.findFirst({
        where: { id: input.ticketId, tenantId, branchId: branch.id },
        select: {
          id: true,
          status: true,
          customerId: true,
          customerName: true,
          customerEmail: true,
          assignedStaffId: true,
          preferredStaffId: true,
        },
      })
    : null;
  if (input.ticketId && !ticket) return { ok: false, error: "That ticket isn't in this branch" };
  if (ticket && ticket.status !== "AWAITING_PAYMENT" && ticket.status !== "IN_SERVICE") {
    return {
      ok: false,
      error:
        ticket.status === "COMPLETED"
          ? `${ticket.customerName} has already been paid for`
          : `${ticket.customerName} isn't ready for payment`,
    };
  }

  const creditedId = input.staffId || ticket?.assignedStaffId || ticket?.preferredStaffId || null;
  const credited = creditedId
    ? await prisma.staff.findFirst({
        where: { id: creditedId, tenantId, role: "BARBER" },
        select: { id: true, name: true },
      })
    : null;
  if (input.staffId && !credited) return { ok: false, error: "That barber isn't in this shop" };

  const customer = ticket?.customerId
    ? { id: ticket.customerId, name: null, email: null }
    : input.customerId
      ? await prisma.customer.findFirst({
          where: { id: input.customerId, tenantId },
          select: { id: true, name: true, email: true },
        })
      : null;
  const typedEmail = clean(input.customerEmail, 200).toLowerCase();
  const customerName =
    ticket?.customerName ?? customer?.name ?? (clean(input.customerName, 120) || "Walk-in Customer");
  const customerEmail =
    ticket?.customerEmail ?? customer?.email ?? (EMAIL_RE.test(typedEmail) ? typedEmail : null);

  // ---- The money -------------------------------------------------------------

  const serviceSubtotal = lines
    .filter((l) => l.type === "service")
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const otherSubtotal =
    lines.filter((l) => l.type === "product").reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) +
    (plan ? Number(plan.price) : 0);
  const gross = serviceSubtotal + otherSubtotal;

  const { mode, value } = input.discount ?? { mode: "amount", value: 0 };
  if (!Number.isFinite(value) || value < 0 || (mode === "percent" && value > 100)) {
    return { ok: false, error: "Check the discount" };
  }
  const discount = mode === "percent" ? round2((gross * value) / 100) : round2(value);
  if (me.role === "CASHIER" && gross > 0 && (discount / gross) * 100 > CASHIER_DISCOUNT_CAP_PCT + 0.001) {
    return { ok: false, error: `Discounts above ${CASHIER_DISCOUNT_CAP_PCT}% need the owner` };
  }

  const tip = Number.isFinite(input.tip) ? input.tip : 0;
  if (tip < 0 || tip > MAX_TIP) return { ok: false, error: "Check the tip" };

  const [taxConfig, rules] = await Promise.all([taxConfigFor(tenantId), commissionRulesFor(tenantId)]);
  const charges = computeCharges({ serviceSubtotal, otherSubtotal, discount, tip, config: taxConfig });

  // Commission is on the goods — never the tip, service charge or SST, and
  // not a membership sold on the visit.
  const commission = credited
    ? calcCommission(
        Math.max(0, charges.goodsTotal - (plan ? Number(plan.price) : 0)),
        credited.id,
        lines,
        rules,
      )
    : 0;

  const card =
    input.method === "card"
      ? {
          cardScheme: clean(input.card?.scheme, 30) || null,
          cardLast4: /^\d{4}$/.test(input.card?.last4 ?? "") ? input.card!.last4! : null,
          cardApprovalCode: clean(input.card?.approvalCode, 30) || null,
        }
      : {};

  const items = [
    ...lines.map((l) => ({
      type: l.type === "service" ? ("SERVICE" as const) : ("PRODUCT" as const),
      refId: l.id,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      total: round2(l.unitPrice * l.quantity),
    })),
    ...(plan
      ? [
          {
            type: "PRODUCT" as const,
            refId: plan.id,
            name: `${plan.name} Membership`,
            quantity: 1,
            unitPrice: Number(plan.price),
            total: Number(plan.price),
          },
        ]
      : []),
  ];
  const soldService = lines.some((l) => l.type === "service");

  // ---- One transaction: the sale and everything it settles -----------------

  try {
    const row = await prisma.$transaction(async (tx) => {
      const counter = await tx.receiptCounter.upsert({
        where: { branchId: branch.id },
        create: { branchId: branch.id, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const now = new Date();

      if (ticket) {
        const settled = await tx.queueTicket.updateMany({
          where: { id: ticket.id, status: { in: ["AWAITING_PAYMENT", "IN_SERVICE"] } },
          data: { status: "COMPLETED", completedAt: now },
        });
        if (settled.count === 0) throw new AlreadySettled();
        await tx.booking.updateMany({
          where: { queueTicketId: ticket.id, status: { in: ["CHECKED_IN", "IN_SERVICE"] } },
          data: { status: "COMPLETED" },
        });
      }

      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId: branch.id,
          customerId: customer?.id ?? null,
          staffId: credited?.id ?? null,
          queueTicketId: ticket?.id ?? null,
          receiptNo: `${receiptPrefix(branch.name)}-${String(counter.lastNumber).padStart(5, "0")}`,
          customerName,
          customerEmail,
          staffName: credited?.name ?? null,
          membershipPlanId: plan?.id ?? null,
          subtotal: charges.subtotal,
          discount: charges.discount,
          discountReason:
            charges.discount > 0 ? clean(input.discount?.reason, 200) || null : null,
          serviceCharge: charges.serviceCharge,
          serviceChargeRate: charges.serviceChargeRate,
          tax: charges.tax,
          taxRate: charges.taxRate,
          tip: charges.tip,
          total: charges.total,
          paymentMethod: method,
          ...card,
          commission,
          idempotencyKey,
          paidAt: now,
          rungById: me.id,
          rungByName: me.name,
          items: { create: items },
        },
        select: saleSelect,
      });

      if (method === "CASH") {
        const drawer = await tx.drawerSession.findFirst({
          where: { branchId: branch.id, closedAt: null },
          select: { id: true },
        });
        if (!drawer) throw new NoDrawer();
        await tx.cashMovement.create({
          data: {
            drawerId: drawer.id,
            branchId: branch.id,
            type: "SALE",
            amount: sale.total,
            note: `${sale.receiptNo} · ${customerName}`,
            saleId: sale.id,
            byId: me.id,
            byName: me.name,
            at: now,
          },
        });
      }

      for (const line of lines.filter((l) => l.type === "product")) {
        await tx.product.updateMany({
          where: { id: line.id, tenantId },
          data: { stock: { decrement: line.quantity } },
        });
      }
      // Stock that was already miscounted stops at zero rather than going negative.
      if (lines.some((l) => l.type === "product")) {
        await tx.product.updateMany({
          where: { tenantId, id: { in: lines.map((l) => l.id) }, stock: { lt: 0 } },
          data: { stock: 0 },
        });
      }

      if (customer && (soldService || plan)) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            ...(soldService ? { lastVisitAt: now } : {}),
            ...(plan ? { membership: plan.tier, membershipPlanId: plan.id } : {}),
          },
        });
      }

      return sale;
    });

    return { ok: true, sale: toSaleDto(row, timeZone) };
  } catch (error) {
    if (error instanceof NoDrawer) return { ok: false, error: NO_DRAWER };
    if (error instanceof AlreadySettled) {
      return { ok: false, error: `${ticket?.customerName ?? "This customer"} has already been paid for` };
    }
    if (isUniqueViolation(error)) {
      // The same bill landed twice at once; the first one won.
      const first = await prisma.sale.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        select: saleSelect,
      });
      if (first) return { ok: true, sale: toSaleDto(first, timeZone) };
      return { ok: false, error: `${ticket?.customerName ?? "This customer"} has already been paid for` };
    }
    throw error;
  }
}

/**
 * The owner reverses a sale. The ticket stays completed — the customer was
 * served — but the sale stops counting: no takings, no commission, and the
 * products go back on the shelf. A cash refund comes out of the branch's open
 * till; with none open it is flagged so it is paid out when one is.
 */
export async function voidSale(saleId: string, reason: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const why = clean(reason, 200);
  if (!why) return { ok: false, error: "Give a reason for the void" };

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId: owner.tenantId },
    select: {
      id: true,
      branchId: true,
      receiptNo: true,
      total: true,
      paymentMethod: true,
      items: { select: { type: true, refId: true, quantity: true } },
    },
  });
  if (!sale) return { ok: false, error: "Sale not found" };

  const voided = await prisma.$transaction(async (tx) => {
    const drawer =
      sale.paymentMethod === "CASH"
        ? await tx.drawerSession.findFirst({
            where: { branchId: sale.branchId, closedAt: null },
            select: { id: true },
          })
        : null;
    const updated = await tx.sale.updateMany({
      where: { id: sale.id, voidedAt: null },
      data: {
        voidedAt: new Date(),
        voidedById: owner.id,
        voidedByName: owner.name,
        voidReason: why,
        refundPending: sale.paymentMethod === "CASH" && !drawer,
      },
    });
    if (updated.count === 0) return false;

    if (drawer) {
      await tx.cashMovement.create({
        data: {
          drawerId: drawer.id,
          branchId: sale.branchId,
          type: "REFUND",
          amount: -Number(sale.total),
          note: `Void ${sale.receiptNo} · ${why}`,
          saleId: sale.id,
          byId: owner.id,
          byName: owner.name,
        },
      });
    }

    // Back on the shelf. A membership line points at a plan, so it matches no product.
    for (const item of sale.items) {
      if (item.type !== "PRODUCT" || !item.refId) continue;
      await tx.product.updateMany({
        where: { id: item.refId, tenantId: owner.tenantId },
        data: { stock: { increment: item.quantity } },
      });
    }
    return true;
  });
  if (!voided) return { ok: false, error: "That sale has already been voided" };

  return { ok: true };
}
