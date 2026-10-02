"use server";

import type { Staff } from "@/generated/prisma/client";
import type {
  QueueSource,
  QueueStatus as PrismaQueueStatus,
} from "@/generated/prisma/enums";
import { requireRole, requireShopSession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

import { readOwnTicketId, rememberOwnTicket } from "./cookie";
import type {
  CreateTicketResult,
  TicketInput,
  TicketPatch,
  WalkInInput,
} from "./dto";
import { queueDateForTenant, ticketSelect, toTicketDto } from "./queries";
import { prismaQueueStatusFor } from "./status";

/**
 * Every write to the queue.
 *
 * Nothing here publishes to Realtime: a trigger on `queue_tickets` broadcasts
 * a poke in the same transaction as the write, so no path — these actions, the
 * seed, Prisma Studio — can change a ticket without the other screens hearing.
 *
 * Barber status (`available` / `busy`) is deliberately not written here yet.
 * Shifts still live in the client store, so the database does not know who has
 * clocked in; each screen derives "busy" from the tickets it is sent.
 */

/** Still in the shop: occupying a place in line or a chair. */
const ACTIVE: PrismaQueueStatus[] = ["WAITING", "CALLED", "IN_SERVICE"];

/**
 * Where a ticket may be moved from, per destination. A ticket already at the
 * destination is accepted separately as a no-op, so a double tap is harmless.
 * `CALLED → AWAITING_PAYMENT` exists because the counter may send a called
 * customer straight to the till.
 */
const MAY_MOVE_FROM: Record<PrismaQueueStatus, PrismaQueueStatus[]> = {
  WAITING: [],
  CALLED: ["WAITING"],
  IN_SERVICE: ["WAITING", "CALLED"],
  AWAITING_PAYMENT: ["CALLED", "IN_SERVICE"],
  COMPLETED: ["IN_SERVICE", "AWAITING_PAYMENT"],
  NO_SHOW: ["WAITING", "CALLED"],
  CANCELLED: ["WAITING", "CALLED"],
};

const MAX_ESTIMATE_MINS = 600;
const NUMBER_RETRIES = 3;

const digitsOf = (value: string | null | undefined) =>
  (value ?? "").replace(/\D/g, "");

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

type Contact = { name: string; phone: string | null; email: string | null };

/**
 * Customers are matched on phone or email rather than created per visit
 * (BACKEND_HANDOFF §4.5), so a returning walk-in keeps one CRM record.
 */
async function resolveCustomerId(
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

type CreateArgs = {
  tenantId: string;
  input: TicketInput;
  source: QueueSource;
  customerHintId?: string;
  /** Refuse when the same contact is already in line (self-service joins). */
  rejectDuplicates: boolean;
};

/**
 * Issues a ticket. The branch must already be known to belong to `tenantId`.
 *
 * The number comes from `queue_counters`, incremented in the same transaction
 * as the insert, so two people joining at once can never share one (§8).
 */
async function createTicket({
  tenantId,
  input,
  source,
  customerHintId,
  rejectDuplicates,
}: CreateArgs): Promise<CreateTicketResult> {
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  if (name.length === 0) {
    return { ok: false, error: "Name is required" };
  }
  if (!phone && !email) {
    return { ok: false, error: "A phone number or email is required" };
  }

  const serviceIds = [...new Set(input.serviceIds)];
  if (serviceIds.length === 0) {
    return { ok: false, error: "Pick at least one service" };
  }
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, tenantId, active: true },
    select: { id: true, name: true, price: true, durationMins: true },
  });
  if (services.length !== serviceIds.length) {
    return { ok: false, error: "That service is no longer available" };
  }
  // Keep the order the customer picked them in.
  const ordered = serviceIds.map((id) => services.find((s) => s.id === id)!);

  if (input.preferredStaffId) {
    const barber = await prisma.staff.findFirst({
      where: {
        id: input.preferredStaffId,
        tenantId,
        branchId: input.branchId,
        role: "BARBER",
        active: true,
      },
      select: { id: true },
    });
    if (!barber) {
      return { ok: false, error: "That barber isn't at this branch" };
    }
  }

  const queueDate = await queueDateForTenant(tenantId);

  if (rejectDuplicates) {
    // One spot per person: the same email or phone already in line here is a
    // double tap or a second device, not a second customer.
    const inLine = await prisma.queueTicket.findMany({
      where: { branchId: input.branchId, queueDate, status: { in: ACTIVE } },
      select: {
        id: true,
        number: true,
        customerPhone: true,
        customerEmail: true,
      },
    });
    const phoneKey = digitsOf(phone);
    const already = inLine.find(
      (t) =>
        (email !== null &&
          (t.customerEmail ?? "").trim().toLowerCase() === email) ||
        (phoneKey.length >= 8 && digitsOf(t.customerPhone) === phoneKey),
    );
    if (already) {
      // Only the device that joined may be told which ticket it is. Anyone
      // else typing a stored email or phone learns nothing about that person.
      const own = (await readOwnTicketId()) === already.id;
      return {
        ok: false,
        error: "Already in the queue with these details",
        duplicate: own ? { own, number: already.number } : { own },
      };
    }
  }

  const customerId = await resolveCustomerId(
    tenantId,
    { name, phone, email },
    customerHintId,
  );

  const estimatedWaitMins = Number.isFinite(input.estimatedWaitMins)
    ? Math.min(MAX_ESTIMATE_MINS, Math.max(0, Math.round(input.estimatedWaitMins)))
    : 0;

  for (let attempt = 1; ; attempt++) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const counter = await tx.queueCounter.upsert({
          where: {
            branchId_queueDate: { branchId: input.branchId, queueDate },
          },
          create: { branchId: input.branchId, queueDate, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
          select: { lastNumber: true },
        });

        return tx.queueTicket.create({
          data: {
            tenantId,
            branchId: input.branchId,
            number: `A${String(counter.lastNumber).padStart(3, "0")}`,
            queueDate,
            customerId,
            customerName: name,
            customerPhone: phone,
            customerEmail: email,
            preferredStaffId: input.preferredStaffId,
            source,
            estimatedWaitMins,
            services: {
              create: ordered.map((s) => ({
                serviceId: s.id,
                name: s.name,
                price: s.price,
                durationMins: s.durationMins,
              })),
            },
          },
          select: ticketSelect,
        });
      });

      return { ok: true, data: { ticket: toTicketDto(row) } };
    } catch (error) {
      // The first two joins of the day can both try to create the counter.
      if (!isUniqueViolation(error) || attempt >= NUMBER_RETRIES) throw error;
    }
  }
}

/**
 * A customer joins from their own phone (BACKEND_HANDOFF §6.3).
 *
 * Unauthenticated by design. The branch id is the only thing taken on trust
 * from the request, and the tenant is read off that branch — so a join can
 * only ever land in the shop whose QR was scanned.
 */
export async function joinQueue(input: TicketInput): Promise<CreateTicketResult> {
  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: { tenantId: true, tenant: { select: { status: true } } },
  });
  if (!branch) {
    return { ok: false, error: "This shop isn't taking walk-ins right now" };
  }
  if (branch.tenant.status === "SUSPENDED") {
    return { ok: false, error: "This shop isn't taking walk-ins right now" };
  }
  if (!input.email?.trim()) {
    // The receipt is emailed, so a self-service join must leave an address.
    return { ok: false, error: "A valid email is required for your receipt" };
  }

  const result = await createTicket({
    tenantId: branch.tenantId,
    input,
    source: "QR",
    rejectDuplicates: true,
  });
  if (result.ok) {
    await rememberOwnTicket(result.data.ticket.id);
  }
  return result;
}

/** The counter registers a walk-in, or checks a booking in to the line. */
export async function registerWalkIn(
  input: WalkInInput,
): Promise<CreateTicketResult> {
  const { staff } = await requireRole("OWNER", "CASHIER");

  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId, tenantId: staff.tenantId },
    select: { id: true },
  });
  if (!branch || (staff.branchId && staff.branchId !== branch.id)) {
    return { ok: false, error: "Branch not found" };
  }

  return createTicket({
    tenantId: staff.tenantId,
    input,
    source: input.source === "booking" ? "BOOKING" : "CASHIER",
    customerHintId: input.customerId,
    rejectDuplicates: false,
  });
}

/** What a barber may do to a ticket: take it, and hand it to the till. */
function barberMay(target: PrismaQueueStatus): boolean {
  return target === "IN_SERVICE" || target === "AWAITING_PAYMENT";
}

/**
 * Move a ticket along: call, start, send to the till, complete, no-show.
 *
 * The update is conditional on the status the ticket is allowed to come from,
 * so when two screens act on the same ticket at once exactly one wins and the
 * other is told it has moved on — rather than the later write silently
 * undoing the earlier one.
 */
export async function updateTicket(
  ticketId: string,
  patch: TicketPatch,
): Promise<ActionResult> {
  const { staff } = await requireShopSession();

  const target = prismaQueueStatusFor(patch.status);
  if (!target) {
    return { ok: false, error: "Unknown status" };
  }

  const ticket = await prisma.queueTicket.findFirst({
    where: { id: ticketId, tenantId: staff.tenantId },
    select: {
      id: true,
      branchId: true,
      status: true,
      assignedStaffId: true,
    },
  });
  if (!ticket || (staff.branchId && staff.branchId !== ticket.branchId)) {
    return { ok: false, error: "Ticket not found" };
  }
  if (ticket.status === target) {
    return { ok: true };
  }

  if (staff.role === "BARBER") {
    if (!barberMay(target)) {
      return { ok: false, error: "Ask the counter to do that" };
    }
    if (target === "AWAITING_PAYMENT" && ticket.assignedStaffId !== staff.id) {
      return { ok: false, error: "That isn't your customer" };
    }
  }

  const now = new Date();
  const data: {
    status: PrismaQueueStatus;
    assignedStaffId?: string;
    chairId?: string | null;
    estimatedWaitMins?: number;
    calledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
  } = { status: target };

  if (target === "CALLED") {
    data.calledAt = now;
  }

  if (target === "IN_SERVICE") {
    const started = await startServiceData(staff, ticket.branchId, patch);
    if (!started.ok) return started;
    Object.assign(data, started.data, { startedAt: now, estimatedWaitMins: 0 });
  }

  if (target === "AWAITING_PAYMENT") {
    data.estimatedWaitMins = 0;
  }

  if (target === "COMPLETED") {
    data.completedAt = now;
  }

  const moved = await prisma.queueTicket.updateMany({
    where: { id: ticket.id, status: { in: MAY_MOVE_FROM[target] } },
    data,
  });
  if (moved.count === 0) {
    return { ok: false, error: "That ticket has already moved on" };
  }

  return { ok: true };
}

/** Who is cutting, and where — validated against the ticket's own branch. */
async function startServiceData(
  actor: Staff,
  branchId: string,
  patch: TicketPatch,
): Promise<
  ActionResult<{ assignedStaffId: string; chairId: string | null }>
> {
  // A barber can only ever take a customer for themselves.
  const barberId =
    actor.role === "BARBER" ? actor.id : (patch.assignedStaffId ?? null);
  if (!barberId) {
    return { ok: false, error: "Pick a barber to start the service" };
  }

  const barber = await prisma.staff.findFirst({
    where: {
      id: barberId,
      tenantId: actor.tenantId,
      branchId,
      role: "BARBER",
      active: true,
    },
    select: { id: true, name: true },
  });
  if (!barber) {
    return { ok: false, error: "That barber isn't at this branch" };
  }

  // Today's tickets only, the same day every screen shows. A service left
  // open on an earlier day is invisible everywhere, so nobody could ever
  // finish it — counting it would lock the barber out for good.
  const busy = await prisma.queueTicket.count({
    where: {
      assignedStaffId: barber.id,
      status: "IN_SERVICE",
      queueDate: await queueDateForTenant(actor.tenantId),
    },
  });
  if (busy > 0) {
    return {
      ok: false,
      error:
        actor.id === barber.id
          ? "Finish your current service first"
          : `${barber.name} is with another customer`,
    };
  }

  // The chair a barber sits at is still picked in the client store, so an id
  // the database does not know is dropped rather than failing the service.
  const chair = patch.chairId
    ? await prisma.chair.findFirst({
        where: { id: patch.chairId, branchId },
        select: { id: true },
      })
    : null;

  return {
    ok: true,
    data: { assignedStaffId: barber.id, chairId: chair?.id ?? null },
  };
}

/** The customer gives up their own place, identified by their cookie. */
export async function leaveQueue(): Promise<ActionResult> {
  const ticketId = await readOwnTicketId();
  if (!ticketId) {
    return { ok: false, error: "We couldn't find your ticket on this device" };
  }

  const left = await prisma.queueTicket.updateMany({
    where: { id: ticketId, status: { in: MAY_MOVE_FROM.CANCELLED } },
    data: { status: "CANCELLED" },
  });
  if (left.count === 0) {
    return { ok: false, error: "Your ticket can no longer be cancelled" };
  }

  return { ok: true };
}

/**
 * A barber has gone for the day: customers who asked for them should not keep
 * waiting for someone who is not coming back, so they become "Any Barber".
 */
export async function releasePreferredBarber(
  staffId: string,
): Promise<ActionResult> {
  const { staff } = await requireShopSession();
  if (staff.role === "BARBER" && staff.id !== staffId) {
    return { ok: false, error: "Unauthorized" };
  }

  await prisma.queueTicket.updateMany({
    where: {
      tenantId: staff.tenantId,
      preferredStaffId: staffId,
      status: { in: ["WAITING", "CALLED"] },
    },
    data: { preferredStaffId: null },
  });

  return { ok: true };
}
