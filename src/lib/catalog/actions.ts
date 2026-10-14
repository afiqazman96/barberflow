"use server";

import type { MembershipTier } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { isUniqueViolation, resolveCustomerId } from "@/lib/customers/resolve";
import { notifyLowStock } from "@/lib/notifications/actions";
import { LOW_STOCK_THRESHOLD } from "@/lib/notifications/constants";
import { prisma } from "@/lib/prisma";
import type { Customer, MembershipPlan, Product, Service } from "@/lib/types";

/**
 * Every write to the catalogue and the customer list. The owner runs the
 * catalogue; the owner and the counter keep customer records. Triggers poke
 * every branch (`20261006000000_catalog_crm`), so nothing here publishes.
 */

const MAX_PRICE = 100_000;
/** A ~700KB picture is ~950KB as base64; leave a little headroom. */
const MAX_IMAGE_CHARS = 1_000_000;
const DATA_URL = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIER_TO_PRISMA = {
  none: "NONE",
  silver: "SILVER",
  gold: "GOLD",
  platinum: "PLATINUM",
} as const satisfies Record<Customer["membership"], MembershipTier>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const money = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_PRICE;

/**
 * What to store for a picture the screen sent back:
 * - `undefined` — not part of this change, leave it;
 * - `null` / "" — removed;
 * - our own `/api/catalog/image/...` link — unchanged, leave it;
 * - a data URL or web address — the new picture.
 */
function imageFor(value: string | null | undefined): string | null | undefined | false {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (value.startsWith("/api/catalog/image/")) return undefined;
  if (value.length <= MAX_IMAGE_CHARS && DATA_URL.test(value)) return value;
  if (/^https:\/\/\S+$/i.test(value) && value.length <= 2000) return value;
  return false;
}

// ---- Services -----------------------------------------------------------------

export async function saveService(
  serviceId: string | null,
  input: Partial<Omit<Service, "id" | "imageUrl">> & { imageUrl?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const data: {
    name?: string;
    category?: string | null;
    durationMins?: number;
    price?: number;
    membershipPrice?: number;
    popular?: boolean;
    imageUrl?: string | null;
  } = {};
  if (input.name !== undefined) {
    data.name = clean(input.name, 80);
    if (!data.name) return { ok: false, error: "Service name is required" };
  }
  if (input.category !== undefined) data.category = clean(input.category, 40) || null;
  if (input.durationMins !== undefined) {
    if (!Number.isInteger(input.durationMins) || input.durationMins < 5 || input.durationMins > 600) {
      return { ok: false, error: "Duration must be 5 to 600 minutes" };
    }
    data.durationMins = input.durationMins;
  }
  if (input.price !== undefined) {
    if (!money(input.price)) return { ok: false, error: "Check the price" };
    data.price = round2(input.price);
  }
  if (input.membershipPrice !== undefined) {
    if (!money(input.membershipPrice)) return { ok: false, error: "Check the member price" };
    data.membershipPrice = round2(input.membershipPrice);
  }
  if (input.popular !== undefined) data.popular = !!input.popular;
  const image = imageFor(input.imageUrl);
  if (image === false) return { ok: false, error: "That picture can't be used" };
  if (image !== undefined) data.imageUrl = image;

  if (serviceId) {
    const updated = await prisma.service.updateMany({
      where: { id: serviceId, tenantId: owner.tenantId },
      data,
    });
    if (updated.count === 0) return { ok: false, error: "Service not found" };
    return { ok: true, data: { id: serviceId } };
  }

  if (!data.name || data.durationMins === undefined || data.price === undefined) {
    return { ok: false, error: "Name, duration and price are required" };
  }
  const created = await prisma.service.create({
    data: {
      tenantId: owner.tenantId,
      name: data.name,
      category: data.category ?? null,
      durationMins: data.durationMins,
      price: data.price,
      membershipPrice: data.membershipPrice ?? data.price,
      popular: data.popular ?? false,
      imageUrl: data.imageUrl ?? null,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: created.id } };
}

/** Stop selling a service. Past sales and queue tickets keep their record. */
export async function removeService(serviceId: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const updated = await prisma.service.updateMany({
    where: { id: serviceId, tenantId: owner.tenantId },
    data: { active: false },
  });
  if (updated.count === 0) return { ok: false, error: "Service not found" };
  return { ok: true };
}

// ---- Products -----------------------------------------------------------------

export async function saveProduct(
  productId: string | null,
  input: Partial<Omit<Product, "id" | "stock" | "imageUrl">> & {
    imageUrl?: string | null;
    /** New products only; stock on hand changes through `adjustProductStock`. */
    stock?: number;
  },
): Promise<ActionResult<{ id: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const data: {
    name?: string;
    category?: string | null;
    sku?: string;
    price?: number;
    imageUrl?: string | null;
  } = {};
  if (input.name !== undefined) {
    data.name = clean(input.name, 80);
    if (!data.name) return { ok: false, error: "Product name is required" };
  }
  if (input.category !== undefined) data.category = clean(input.category, 40) || null;
  if (input.sku !== undefined) {
    data.sku = clean(input.sku, 40);
    if (!data.sku) return { ok: false, error: "SKU is required" };
  }
  if (input.price !== undefined) {
    if (!money(input.price)) return { ok: false, error: "Check the price" };
    data.price = round2(input.price);
  }
  const image = imageFor(input.imageUrl);
  if (image === false) return { ok: false, error: "That picture can't be used" };
  if (image !== undefined) data.imageUrl = image;

  try {
    if (productId) {
      const updated = await prisma.product.updateMany({
        where: { id: productId, tenantId: owner.tenantId },
        data,
      });
      if (updated.count === 0) return { ok: false, error: "Product not found" };
      return { ok: true, data: { id: productId } };
    }

    if (!data.name || !data.sku || data.price === undefined) {
      return { ok: false, error: "Name, SKU and price are required" };
    }
    const stock = Number.isInteger(input.stock) && input.stock! >= 0 ? input.stock! : 0;
    const created = await prisma.product.create({
      data: {
        tenantId: owner.tenantId,
        name: data.name,
        category: data.category ?? null,
        sku: data.sku,
        price: data.price,
        stock: Math.min(stock, 100_000),
        imageUrl: data.imageUrl ?? null,
      },
      select: { id: true },
    });
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Another product already has that SKU" };
    throw error;
  }
}

/**
 * Count stock in or out. A change, not a new total, so it can't overwrite a
 * sale the till made a moment ago; it stops at zero.
 */
export async function adjustProductStock(productId: string, delta: number): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) {
    return { ok: false, error: "Check the stock change" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findFirst({
      where: { id: productId, tenantId: owner.tenantId },
      select: { stock: true, name: true },
    });
    if (!before) return null;

    const moved = await tx.product.updateMany({
      where: { id: productId, tenantId: owner.tenantId },
      data: { stock: { increment: delta } },
    });
    if (moved.count > 0) {
      await tx.product.updateMany({
        where: { id: productId, stock: { lt: 0 } },
        data: { stock: 0 },
      });
    }
    const after = await tx.product.findFirst({
      where: { id: productId },
      select: { stock: true },
    });

    // Only when stock just crossed at/under the threshold, not every
    // decrement while it's already low.
    if (
      before.stock > LOW_STOCK_THRESHOLD &&
      after &&
      after.stock <= LOW_STOCK_THRESHOLD
    ) {
      await notifyLowStock(
        { tenantId: owner.tenantId, name: before.name, stock: after.stock },
        tx,
      );
    }

    return after?.stock ?? null;
  });
  if (result === null) return { ok: false, error: "Product not found" };
  return { ok: true };
}

/** Stop selling a product. Past sales keep their record; stock on hand is frozen. */
export async function removeProduct(productId: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const updated = await prisma.product.updateMany({
    where: { id: productId, tenantId: owner.tenantId },
    data: { active: false },
  });
  if (updated.count === 0) return { ok: false, error: "Product not found" };
  return { ok: true };
}

// ---- Membership plans ---------------------------------------------------------

export async function saveMembershipPlan(
  planId: string | null,
  input: Omit<MembershipPlan, "id" | "members">,
): Promise<ActionResult<{ id: string }>> {
  const { staff: owner } = await requireRole("OWNER");

  const name = clean(input.name, 60);
  if (!name) return { ok: false, error: "Plan name is required" };
  // Typed as a paid tier, but it came over the wire.
  const tier = TIER_TO_PRISMA[input.tier as Customer["membership"]];
  if (!tier || tier === "NONE") return { ok: false, error: "Pick a tier" };
  if (!money(input.price)) return { ok: false, error: "Check the price" };
  if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100) {
    return { ok: false, error: "The discount must be 0 to 100%" };
  }
  const data = {
    name,
    tier,
    price: round2(input.price),
    discountPercent: round2(input.discountPercent),
    benefits: (input.benefits ?? []).map((b) => clean(b, 120)).filter(Boolean).slice(0, 20),
    active: true,
  };

  // One plan per tier. A plan removed earlier is brought back rather than
  // duplicated, so its past members still point at it.
  const sameTier = await prisma.membershipPlan.findUnique({
    where: { tenantId_tier: { tenantId: owner.tenantId, tier } },
    select: { id: true, active: true },
  });
  if (sameTier && sameTier.id !== planId && sameTier.active) {
    return { ok: false, error: `There is already a ${input.tier} plan` };
  }

  try {
    if (planId && (!sameTier || sameTier.id === planId)) {
      const updated = await prisma.membershipPlan.updateMany({
        where: { id: planId, tenantId: owner.tenantId },
        data,
      });
      if (updated.count === 0) return { ok: false, error: "Plan not found" };
      return { ok: true, data: { id: planId } };
    }
    if (sameTier) {
      // Re-tiering onto, or re-adding, a removed plan's tier.
      if (planId) {
        await prisma.membershipPlan.updateMany({
          where: { id: planId, tenantId: owner.tenantId },
          data: { active: false },
        });
      }
      await prisma.membershipPlan.update({ where: { id: sameTier.id }, data });
      return { ok: true, data: { id: sameTier.id } };
    }
    const created = await prisma.membershipPlan.create({
      data: { tenantId: owner.tenantId, ...data },
      select: { id: true },
    });
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `There is already a ${input.tier} plan` };
    throw error;
  }
}

/** Stop selling a plan. Its members keep their tier. */
export async function removeMembershipPlan(planId: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  const updated = await prisma.membershipPlan.updateMany({
    where: { id: planId, tenantId: owner.tenantId },
    data: { active: false },
  });
  if (updated.count === 0) return { ok: false, error: "Plan not found" };
  return { ok: true };
}

// ---- Customers ----------------------------------------------------------------

type CustomerInput = Partial<
  Pick<Customer, "name" | "phone" | "email" | "membership" | "notes" | "preferredStaffId">
>;

async function customerData(tenantId: string, input: CustomerInput) {
  const data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    membership?: MembershipTier;
    membershipPlanId?: string | null;
    preferredStaffId?: string | null;
  } = {};
  if (input.name !== undefined) {
    data.name = clean(input.name, 120);
    if (!data.name) return { error: "Name is required" } as const;
  }
  if (input.phone !== undefined) data.phone = clean(input.phone, 40) || null;
  if (input.email !== undefined) {
    const email = clean(input.email, 200).toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { error: "Check the email address" } as const;
    data.email = email || null;
  }
  if (input.notes !== undefined) data.notes = clean(input.notes, 1000) || null;
  if (input.membership !== undefined) {
    const tier = TIER_TO_PRISMA[input.membership];
    if (!tier) return { error: "Unknown membership" } as const;
    data.membership = tier;
    data.membershipPlanId =
      tier === "NONE"
        ? null
        : ((
            await prisma.membershipPlan.findUnique({
              where: { tenantId_tier: { tenantId, tier } },
              select: { id: true },
            })
          )?.id ?? null);
  }
  if (input.preferredStaffId !== undefined) {
    const staff = input.preferredStaffId
      ? await prisma.staff.findFirst({
          where: { id: input.preferredStaffId, tenantId, role: "BARBER" },
          select: { id: true },
        })
      : null;
    if (input.preferredStaffId && !staff) return { error: "That barber isn't in this shop" } as const;
    data.preferredStaffId = staff?.id ?? null;
  }
  return { data } as const;
}

const DUPLICATE = "Another customer already has that phone number or email";

export async function createCustomer(
  input: CustomerInput & { name: string; phone: string },
): Promise<ActionResult<{ id: string }>> {
  const { staff } = await requireRole("OWNER", "CASHIER");

  const built = await customerData(staff.tenantId, input);
  if ("error" in built) return { ok: false, error: built.error! };
  if (!built.data.name || !built.data.phone) return { ok: false, error: "Name and phone are required" };

  try {
    const created = await prisma.customer.create({
      data: { tenantId: staff.tenantId, ...built.data, name: built.data.name },
      select: { id: true },
    });
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: DUPLICATE };
    throw error;
  }
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<ActionResult> {
  const { staff } = await requireRole("OWNER", "CASHIER");

  const built = await customerData(staff.tenantId, input);
  if ("error" in built) return { ok: false, error: built.error! };
  if (input.phone !== undefined && !built.data.phone) {
    return { ok: false, error: "Name and phone are required" };
  }

  try {
    const updated = await prisma.customer.updateMany({
      where: { id: customerId, tenantId: staff.tenantId },
      data: built.data,
    });
    if (updated.count === 0) return { ok: false, error: "Customer not found" };
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: DUPLICATE };
    throw error;
  }
}

/**
 * Delete a customer with no history. `Booking`/`QueueTicket` both require a
 * customer with no `onDelete` clause, so Postgres refuses outright if either
 * exists; `Sale.customerId` is optional and would just go null, silently
 * stripping their lifetime spend from the CRM. Checked explicitly instead of
 * letting either of those happen — anyone with real history should be
 * merged into another record, never deleted.
 */
export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: owner.tenantId },
    select: {
      _count: { select: { sales: true, bookings: true, queueTickets: true } },
    },
  });
  if (!customer) return { ok: false, error: "Customer not found" };
  const { sales, bookings, queueTickets } = customer._count;
  if (sales > 0 || bookings > 0 || queueTickets > 0) {
    return {
      ok: false,
      error: "This customer has sales or visit history — merge them into another customer instead",
    };
  }

  const deleted = await prisma.customer.deleteMany({
    where: { id: customerId, tenantId: owner.tenantId },
  });
  if (deleted.count === 0) return { ok: false, error: "Customer not found" };
  return { ok: true };
}

/**
 * Merge a duplicate into the record being kept: every sale, booking and
 * queue ticket moves from the loser to the winner, then the loser is
 * deleted. The winner's own name, membership and preferred barber are left
 * exactly as they are — this only ever adds history, never overwrites a
 * choice the owner already made on the kept record — except a phone or
 * email the winner is missing, filled in from the loser so the merged
 * record stays reachable, and notes, which are combined.
 */
export async function mergeCustomers(
  winnerId: string,
  loserId: string,
): Promise<ActionResult> {
  const { staff: owner } = await requireRole("OWNER");
  if (winnerId === loserId) {
    return { ok: false, error: "Pick two different customers" };
  }

  const [winner, loser] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: winnerId, tenantId: owner.tenantId },
      select: { phone: true, email: true, notes: true, lastVisitAt: true },
    }),
    prisma.customer.findFirst({
      where: { id: loserId, tenantId: owner.tenantId },
      select: { phone: true, email: true, notes: true, lastVisitAt: true },
    }),
  ]);
  if (!winner || !loser) return { ok: false, error: "Customer not found" };

  const notes = [winner.notes, loser.notes].filter(Boolean).join("\n");
  const lastVisitAt =
    !winner.lastVisitAt || (loser.lastVisitAt && loser.lastVisitAt > winner.lastVisitAt)
      ? loser.lastVisitAt
      : winner.lastVisitAt;

  await prisma.$transaction(async (tx) => {
    await tx.sale.updateMany({
      where: { customerId: loserId, tenantId: owner.tenantId },
      data: { customerId: winnerId },
    });
    await tx.booking.updateMany({
      where: { customerId: loserId, tenantId: owner.tenantId },
      data: { customerId: winnerId },
    });
    await tx.queueTicket.updateMany({
      where: { customerId: loserId, tenantId: owner.tenantId },
      data: { customerId: winnerId },
    });

    // The loser's own phone/email must be gone before the winner can borrow
    // either — both columns are unique per tenant, and the two rows would
    // collide for as long as they both held the same value.
    await tx.customer.deleteMany({ where: { id: loserId, tenantId: owner.tenantId } });
    await tx.customer.updateMany({
      where: { id: winnerId, tenantId: owner.tenantId },
      data: {
        phone: winner.phone ?? loser.phone,
        email: winner.email ?? loser.email,
        notes: notes || null,
        lastVisitAt,
      },
    });
  });

  return { ok: true };
}

/**
 * A customer, from their own phone, asks to be signed up for a plan. There is
 * no payment capture anywhere in this app — this does not activate the tier
 * itself (only `updateCustomer`, staff-only, does that, normally from a POS
 * sale). It leaves a note on their CRM record so the counter can collect
 * payment and flip the tier on their next visit. Unauthenticated by design,
 * the same trust level as `bookAppointment`/`joinQueue`.
 */
export async function requestMembershipInterest(input: {
  branchId: string;
  name: string;
  phone: string;
  email?: string;
  planName: string;
}): Promise<ActionResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: { tenantId: true },
  });
  if (!branch) return { ok: false, error: "Shop not found" };

  const name = clean(input.name, 120);
  const phone = clean(input.phone, 40);
  if (!name) return { ok: false, error: "Name is required" };
  if (!phone) return { ok: false, error: "Phone number is required" };
  const planName = clean(input.planName, 60);
  if (!planName) return { ok: false, error: "Pick a plan" };
  const email = clean(input.email, 200).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Check the email address" };

  const customerId = await resolveCustomerId(branch.tenantId, {
    name,
    phone,
    email: email || null,
  });

  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { notes: true },
  });
  const stamp = `[${new Date().toISOString().slice(0, 10)}] Asked to join ${planName} — confirm and take payment at the counter.`;
  const notes = [existing?.notes, stamp].filter(Boolean).join("\n").slice(0, 1000);

  await prisma.customer.update({ where: { id: customerId }, data: { notes } });
  return { ok: true };
}
