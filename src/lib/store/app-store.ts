"use client";

import { create } from "zustand";

import type { SessionUser } from "@/lib/auth/dto";
import type {
  Booking,
  Branch,
  BusinessProfile,
  CashMovement,
  Chair,
  CommissionRule,
  Customer,
  DrawerSession,
  LeaveEntry,
  MembershipPlan,
  OpsRules,
  PaymentMethod,
  Product,
  QueueTicket,
  RosterDay,
  Sale,
  Service,
  ShiftRecord,
  StaffMember,
  StaffStatus,
  TaxConfig,
  UserRole,
} from "@/lib/types";
import { computeCharges, DEFAULT_TAX_CONFIG } from "@/lib/pos-pricing";
import {
  AUTO_CLOSE_GRACE_MINS,
  closingMins,
  emptyWeek,
  localIso,
  minsOfDay,
  openShiftOf,
  parseIso,
} from "@/lib/roster";
import { LEAVES, ROSTER, SHIFTS } from "@/lib/mock/roster-data";
import { DRAWER_HISTORY } from "@/lib/mock/drawer-data";
import {
  CASHIER_PAYOUT_LIMIT,
  DRAWER_VARIANCE_TOLERANCE,
  MIN_VARIANCE_REASON,
} from "@/lib/drawer";
import {
  BOOKINGS,
  BRANCHES,
  CHAIRS,
  COMMISSION_RULES,
  CUSTOMERS,
  MEMBERSHIP_PLANS,
  PRODUCTS,
  QUEUE,
  SALES,
  SERVICES,
  STAFF,
  TENANT,
} from "@/lib/mock/data";

interface PosItem {
  id: string;
  type: "service" | "product";
  name: string;
  quantity: number;
  unitPrice: number;
}

interface AppState {
  /**
   * The verified session, mirrored from the server by `<SessionSync>` so that
   * client-only screens can read who is signed in. Never write to it from a
   * form or a page — the server guards are the source of truth, this is a
   * read-through copy that disappears on refresh and is re-seeded by the
   * portal layout.
   */
  session: SessionUser | null;
  role: UserRole | null;
  staffId: string | null;
  branchId: string;
  businessProfile: BusinessProfile;
  opsRules: OpsRules;
  updateOpsRules: (patch: Partial<OpsRules>) => void;
  /** Owner-configured service charge / SST, applied across every POS screen. */
  taxConfig: TaxConfig;
  queue: QueueTicket[];
  bookings: Booking[];
  sales: Sale[];
  staff: StaffMember[];
  branches: Branch[];
  chairs: Chair[];
  commissionRules: CommissionRule[];
  services: Service[];
  products: Product[];
  membershipPlans: MembershipPlan[];
  /** CRM customers. Owned by the store (not the static mock import) so the
   * owner's Customer page can actually add/edit records, and every POS/queue
   * screen that resolves a customer sees the same edits. */
  customers: Customer[];
  staffStatuses: Record<string, StaffStatus>;
  /** Clock-in/out log for barbers and cashiers, newest first. */
  shifts: ShiftRecord[];
  /** Weekly roster per staff id; index 0 = Sunday. */
  roster: Record<string, RosterDay[]>;
  leaves: LeaveEntry[];
  posItems: PosItem[];
  posDiscount: number;
  posDiscountMode: "amount" | "percent";
  posDiscountReason: string;
  posTip: number;
  posCustomerId: string | null;
  /** The queue ticket being checked out, if the sale came from the queue. */
  posTicketId: string | null;
  /** The barber the sale (and its commission) is credited to. */
  posStaffId: string | null;
  /** A membership plan being sold to the customer on this visit. */
  posMembershipPlanId: string | null;
  lastReceipt: Sale | null;
  /** The open cash-drawer shift, or null when the till is closed. */
  drawerSession: DrawerSession | null;
  drawerHistory: DrawerSession[];
  trackingTicketId: string | null;
  /** The booking a customer is following before they've been checked in. */
  trackingBookingId: string | null;

  setSession: (session: SessionUser | null) => void;
  setRole: (role: UserRole | null, staffId?: string | null) => void;
  setBranchId: (id: string) => void;
  updateBusinessProfile: (patch: Partial<BusinessProfile>) => void;
  updateTaxConfig: (patch: Partial<TaxConfig>) => void;
  updateStaffStatus: (staffId: string, status: StaffStatus) => void;
  /** Clock a barber or cashier in. The only way from off-duty to on-duty. */
  startShift: (
    staffId: string,
    opts?: { chairId?: string | null; by?: "self" | "owner"; note?: string },
  ) => { ok: boolean; error?: string };
  /** Clock out and free their chair. Refuses mid-service or with the till open. */
  endShift: (
    staffId: string,
    opts?: { by?: "self" | "owner"; note?: string },
  ) => { ok: boolean; error?: string };
  /** Ends shifts left open past closing time, or from a previous day. */
  closeStaleShifts: (now: Date) => void;
  setRosterDay: (staffId: string, weekday: number, patch: Partial<RosterDay>) => void;
  addLeave: (input: Omit<LeaveEntry, "id">) => void;
  removeLeave: (id: string) => void;
  setStaffPassword: (
    staffId: string,
    password: string,
    opts?: { mustChangePassword?: boolean },
  ) => void;
  addStaff: (staff: Omit<StaffMember, "id" | "todaySales" | "todayCommission" | "todayCustomers" | "monthlySales" | "monthlyCommission" | "rating"> & Partial<StaffMember>) => StaffMember;
  updateStaff: (id: string, patch: Partial<StaffMember>) => void;
  addBranch: (branch: Omit<Branch, "id" | "tenantId" | "queueCount" | "avgWaitMins"> & Partial<Branch>) => Branch;
  updateBranch: (id: string, patch: Partial<Branch>) => void;
  addChair: (input: { branchId: string; label?: string }) => Chair;
  updateChair: (id: string, patch: Partial<Chair>) => void;
  assignChair: (chairId: string, staffId: string | null) => void;
  addCommissionRule: (rule: Omit<CommissionRule, "id">) => CommissionRule;
  updateCommissionRule: (id: string, patch: Partial<CommissionRule>) => void;
  addService: (service: Omit<Service, "id">) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  addMembershipPlan: (plan: Omit<MembershipPlan, "id">) => MembershipPlan;
  updateMembershipPlan: (id: string, patch: Partial<MembershipPlan>) => void;
  deleteMembershipPlan: (id: string) => void;
  addCustomer: (customer: Omit<Customer, "id" | "visits" | "totalSpent"> & Partial<Customer>) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addProduct: (product: Omit<Product, "id">) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addQueueTicket: (ticket: QueueTicket) => void;
  updateQueueTicket: (id: string, patch: Partial<QueueTicket>) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  setPosItems: (items: PosItem[]) => void;
  addPosItem: (item: PosItem) => void;
  updatePosQty: (id: string, quantity: number) => void;
  removePosItem: (id: string) => void;
  setPosDiscount: (n: number) => void;
  setPosDiscountMode: (mode: "amount" | "percent") => void;
  setPosDiscountReason: (reason: string) => void;
  setPosTip: (n: number) => void;
  setPosCustomerId: (id: string | null) => void;
  /**
   * Pick a customer by name (not by ticket). If they have a service waiting
   * to be paid for, loads that ticket so the barber who served them and
   * their items carry over — same as picking them off the ticket list.
   */
  selectPosCustomer: (id: string | null) => void;
  setPosMembershipPlan: (planId: string | null) => void;
  /** Load a queue ticket into the POS: customer, its barber, and its services. */
  loadPosTicket: (ticketId: string) => void;
  setPosStaffId: (id: string | null) => void;
  clearPos: () => void;
  completePayment: (
    method: PaymentMethod,
    card?: Sale["card"],
  ) => Sale;
  voidSale: (saleId: string, reason: string, by: string) => void;
  openDrawer: (input: {
    cashierId: string;
    cashierName: string;
    openingFloat: number;
  }) => { ok: boolean; error?: string };
  addCashMovement: (input: {
    type: CashMovement["type"];
    amount: number;
    note: string;
    saleId?: string;
    category?: string;
  }) => { ok: boolean; error?: string };
  /**
   * Close the drawer from a count. The cashier is never told the expected
   * figure or the variance: a count that is off is bounced for one recount,
   * then needs a written reason and goes to the owner for review.
   */
  closeDrawer: (input: {
    countedAmount: number;
    denominations?: Record<string, number>;
    closingNote?: string;
  }) => { result: CloseDrawerResult; message?: string };
  /** Owner signs off a close that came in outside tolerance. */
  reviewDrawer: (id: string, note: string) => { ok: boolean; error?: string };
  setTrackingTicketId: (id: string | null) => void;
  setTrackingBookingId: (id: string | null) => void;
}

/**
 * Commission on a sale. `total` is the goods figure after any discount.
 *
 * - A staff-specific Percentage or Fixed rule scoped to "all" replaces the
 *   barber's rate entirely (an override).
 * - Otherwise each item earns a base rate — the most specific matching
 *   percentage rule wins (one for that exact service/product, then the
 *   service/product default, then a rule for everything). No matching rule
 *   means no base commission; there is no hidden default.
 * - A staff-specific Service/Product percentage rule adds on top as a bonus.
 * - Fixed rules add a flat amount for each eligible item sold.
 * - A discount lowers what every line earns commission on, pro rata.
 */
export function calcCommission(
  total: number,
  staffId: string,
  items: PosItem[],
  rules: CommissionRule[],
): number {
  const active = rules.filter((r) => r.active);
  const staffOverride = active.find(
    (r) =>
      r.staffId === staffId &&
      r.appliesTo === "all" &&
      (r.type === "percentage" || r.type === "fixed"),
  );
  if (staffOverride) {
    return staffOverride.type === "percentage"
      ? Math.round(total * (staffOverride.value / 100) * 100) / 100
      : Math.round(staffOverride.value * 100) / 100;
  }

  const isPercent = (r: CommissionRule) =>
    r.type === "percentage" || r.type === "service-based" || r.type === "product-based";
  const specificity = (r: CommissionRule) =>
    r.serviceId || r.productId ? 2 : r.appliesTo === "all" ? 0 : 1;

  const gross = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const ratio = gross > 0 ? Math.min(1, Math.max(0, total) / gross) : 1;

  let commission = 0;
  for (const item of items) {
    const line = item.unitPrice * item.quantity * ratio;
    const matching = active.filter((r) => {
      if (r.staffId && r.staffId !== staffId) return false;
      if (r.appliesTo === "all") return true;
      if (r.appliesTo === "service" && item.type === "service") {
        return !r.serviceId || r.serviceId === item.id;
      }
      if (r.appliesTo === "product" && item.type === "product") {
        return !r.productId || r.productId === item.id;
      }
      return false;
    });

    const base = matching
      .filter((r) => isPercent(r) && !(r.staffId && r.appliesTo !== "all"))
      .sort((a, b) => specificity(b) - specificity(a))[0];
    const bonus = matching
      .filter((r) => isPercent(r) && r.staffId && r.appliesTo !== "all")
      .reduce((sum, r) => sum + r.value, 0);
    const fixed = matching
      .filter((r) => r.type === "fixed")
      .reduce((sum, r) => sum + r.value * item.quantity, 0);

    commission += line * (((base?.value ?? 0) + bonus) / 100) + fixed;
  }

  return Math.round(commission * 100) / 100;
}

const initialStatuses = Object.fromEntries(
  STAFF.map((s) => [s.id, s.status]),
) as Record<string, StaffStatus>;

/** Everything that changes when someone clocks out, or is forced out. */
export type CloseDrawerResult =
  | "closed"
  | "needs-review"
  | "recount"
  | "reason-required"
  | "blocked"
  | "forbidden";

/** Who is acting, from the server-verified session mirrored into the store. */
function actorOf(s: AppState) {
  return {
    id: s.session?.staffId ?? null,
    name: s.session?.name ?? "Unknown",
    role: s.session?.role ?? null,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A barber is "busy" exactly when a ticket is in service under them. Keeps the
 * flag honest whoever moves the ticket (barber, cashier, POS) — and never
 * touches someone who is off duty or on a break.
 */
function barberSyncPatch(
  s: AppState,
  queue: QueueTicket[],
  staffIds: Iterable<string | null | undefined>,
): Partial<AppState> {
  let statuses = s.staffStatuses;
  let staff = s.staff;
  for (const id of staffIds) {
    if (!id) continue;
    const cur = statuses[id] ?? staff.find((m) => m.id === id)?.status;
    const busyNow = queue.some(
      (q) => q.assignedStaffId === id && q.status === "in-service",
    );
    const next =
      cur === "busy" && !busyNow
        ? ("available" as const)
        : cur === "available" && busyNow
          ? ("busy" as const)
          : null;
    if (!next) continue;
    statuses = { ...statuses, [id]: next };
    staff = staff.map((m) => (m.id === id ? { ...m, status: next } : m));
  }
  return statuses === s.staffStatuses ? {} : { staffStatuses: statuses, staff };
}

function closeShiftPatch(
  s: AppState,
  staffId: string,
  by: "self" | "owner" | "auto",
  note?: string,
  at: string = new Date().toISOString(),
): Partial<AppState> {
  return {
    shifts: s.shifts.map((sh) =>
      sh.staffId === staffId && !sh.endedAt
        ? { ...sh, endedAt: at, endedBy: by, note: note ?? sh.note }
        : sh,
    ),
    chairs: s.chairs.map((c) => (c.staffId === staffId ? { ...c, staffId: null } : c)),
    // Customers who asked for this barber shouldn't wait for someone who's gone.
    queue: s.queue.map((q) =>
      q.preferredStaffId === staffId && (q.status === "waiting" || q.status === "called")
        ? { ...q, preferredStaffId: null }
        : q,
    ),
    staff: s.staff.map((m) =>
      m.id === staffId ? { ...m, status: "off-duty" as const, chairId: null } : m,
    ),
    staffStatuses: { ...s.staffStatuses, [staffId]: "off-duty" as const },
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  role: null,
  session: null,
  staffId: null,
  branchId: "b1",
  businessProfile: {
    name: TENANT.name,
    phone: "+60 3-2141 8890",
    email: "hello@fadehouse.my",
    address: "88 Jalan Bukit Bintang, Lot 12, KL",
    taxId: "W10-1808-32000123",
  },
  taxConfig: { ...DEFAULT_TAX_CONFIG },
  opsRules: {
    gracePeriodMins: 10,
    maxWaitMins: 45,
    advanceDays: 7,
    cancelHours: 4,
    slotInterval: 30,
  },
  queue: QUEUE,
  bookings: BOOKINGS,
  sales: SALES,
  staff: STAFF.map((s) => ({ ...s })),
  branches: BRANCHES.map((b) => ({ ...b })),
  chairs: CHAIRS.map((c) => ({ ...c })),
  commissionRules: COMMISSION_RULES.map((r) => ({ ...r })),
  services: SERVICES.map((s) => ({ ...s })),
  membershipPlans: MEMBERSHIP_PLANS.map((p) => ({ ...p })),
  products: PRODUCTS.map((p) => ({ ...p })),
  customers: CUSTOMERS.map((c) => ({ ...c })),
  staffStatuses: initialStatuses,
  shifts: SHIFTS.map((x) => ({ ...x })),
  roster: Object.fromEntries(
    Object.entries(ROSTER).map(([id, days]) => [id, days.map((d) => ({ ...d }))]),
  ),
  leaves: LEAVES.map((l) => ({ ...l })),
  posItems: [],
  posDiscount: 0,
  posDiscountMode: "amount",
  posDiscountReason: "",
  posTip: 0,
  posCustomerId: null,
  posTicketId: null,
  posStaffId: null,
  posMembershipPlanId: null,
  drawerSession: null,
  drawerHistory: DRAWER_HISTORY.map((d) => ({
    ...d,
    movements: d.movements.map((m) => ({ ...m })),
  })),
  lastReceipt: null,
  trackingTicketId: null,
  trackingBookingId: null,

  setSession: (session) =>
    set((s) => ({
      session,
      role: session?.role ?? null,
      staffId: session?.staffId ?? null,
      // Owners have no home branch (branchId is null) and can switch freely, so
      // leave whatever branch they were looking at selected.
      branchId: session?.branchId ?? s.branchId,
    })),
  setRole: (role, staffId = null) => set({ role, staffId }),
  setBranchId: (branchId) =>
    set((s) =>
      branchId === s.branchId
        ? {}
        : {
            branchId,
            // A half-rung sale belongs to the branch it was started in.
            posItems: [],
            posDiscount: 0,
            posDiscountReason: "",
            posTip: 0,
            posCustomerId: null,
            posTicketId: null,
            posStaffId: null,
            posMembershipPlanId: null,
          },
    ),
  updateBusinessProfile: (patch) =>
    set((s) => ({
      businessProfile: { ...s.businessProfile, ...patch },
    })),
  updateTaxConfig: (patch) =>
    set((s) => ({ taxConfig: { ...s.taxConfig, ...patch } })),
  updateOpsRules: (patch) =>
    set((s) => ({ opsRules: { ...s.opsRules, ...patch } })),

  updateStaffStatus: (staffId, status) =>
    set((s) => {
      const member = s.staff.find((m) => m.id === staffId);
      const current = s.staffStatuses[staffId] ?? member?.status;
      if (member && member.role !== "owner") {
        // Going on duty is a clock-in and going off duty a clock-out, so
        // neither can be done by just flipping the flag.
        if (current === "off-duty" && status !== "off-duty") return {};
        if (status === "off-duty") return closeShiftPatch(s, staffId, "self");
      }
      return {
        staffStatuses: { ...s.staffStatuses, [staffId]: status },
        staff: s.staff.map((m) => (m.id === staffId ? { ...m, status } : m)),
      };
    }),

  startShift: (staffId, opts) => {
    const s = get();
    const m = s.staff.find((x) => x.id === staffId);
    if (!m || !m.active) return { ok: false, error: "This account is disabled" };
    if (m.role === "owner") return { ok: false, error: "Owners do not clock in" };
    if (openShiftOf(s.shifts, staffId)) return { ok: true };

    const chairId = m.role === "barber" ? (opts?.chairId ?? m.chairId ?? null) : null;
    if (chairId) {
      const chair = s.chairs.find((c) => c.id === chairId);
      if (!chair || chair.branchId !== m.branchId) {
        return { ok: false, error: "Pick a chair at your own branch" };
      }
      if (chair.staffId && chair.staffId !== staffId) {
        return { ok: false, error: `${chair.label} is already taken` };
      }
    }
    const now = new Date();
    const record: ShiftRecord = {
      id: `sh-${Date.now()}`,
      staffId,
      branchId: m.branchId,
      date: localIso(now),
      startedAt: now.toISOString(),
      chairId,
      startedBy: opts?.by ?? "self",
      note: opts?.note,
    };
    set((st) => ({
      shifts: [record, ...st.shifts],
      staffStatuses: { ...st.staffStatuses, [staffId]: "available" },
      staff: st.staff.map((x) =>
        x.id === staffId ? { ...x, status: "available" as const } : x,
      ),
    }));
    if (chairId) get().assignChair(chairId, staffId);
    return { ok: true };
  },

  endShift: (staffId, opts) => {
    const s = get();
    const m = s.staff.find((x) => x.id === staffId);
    if (!m) return { ok: false, error: "Staff member not found" };
    if (s.queue.some((q) => q.assignedStaffId === staffId && q.status === "in-service")) {
      return { ok: false, error: "Finish the current service first" };
    }
    if (s.drawerSession && !s.drawerSession.closedAt && s.drawerSession.cashierId === staffId) {
      return { ok: false, error: "Close the cash drawer first" };
    }
    set((st) => closeShiftPatch(st, staffId, opts?.by ?? "self", opts?.note));
    return { ok: true };
  },

  closeStaleShifts: (now) => {
    const s = get();
    const today = localIso(now);
    const nowMins = minsOfDay(now);
    const due: { staffId: string; at: Date }[] = [];
    for (const sh of s.shifts) {
      if (sh.endedAt) continue;
      if (s.queue.some((q) => q.assignedStaffId === sh.staffId && q.status === "in-service")) continue;
      if (s.drawerSession && !s.drawerSession.closedAt && s.drawerSession.cashierId === sh.staffId) continue;
      const close = closingMins(s.branches.find((b) => b.id === sh.branchId));
      // A shift started after closing (stock take, late clean-up) stays open
      // until the next day rather than being closed with zero minutes.
      const startedMins = minsOfDay(new Date(sh.startedAt));
      const stale =
        sh.date < today ||
        (sh.date === today &&
          startedMins < close &&
          nowMins >= close + AUTO_CLOSE_GRACE_MINS);
      if (!stale) continue;
      const closeAt = parseIso(sh.date);
      closeAt.setHours(0, close, 0, 0);
      const started = new Date(sh.startedAt);
      due.push({ staffId: sh.staffId, at: closeAt > started ? closeAt : started });
    }
    for (const d of due) {
      set((st) =>
        closeShiftPatch(st, d.staffId, "auto", "Auto-closed: shift was not ended", d.at.toISOString()),
      );
    }
  },

  setRosterDay: (staffId, weekday, patch) =>
    set((s) => ({
      roster: {
        ...s.roster,
        [staffId]: (s.roster[staffId] ?? emptyWeek()).map((d, i) =>
          i === weekday ? { ...d, ...patch } : d,
        ),
      },
    })),

  addLeave: (input) =>
    set((s) => ({
      leaves: [
        { id: `lv-${Date.now()}`, ...input },
        ...s.leaves.filter((l) => !(l.staffId === input.staffId && l.date === input.date)),
      ],
    })),

  removeLeave: (id) => set((s) => ({ leaves: s.leaves.filter((l) => l.id !== id) })),

  setStaffPassword: (staffId, password, opts) =>
    set((s) => ({
      staff: s.staff.map((m) =>
        m.id === staffId
          ? {
              ...m,
              password,
              mustChangePassword: opts?.mustChangePassword ?? false,
            }
          : m,
      ),
    })),

  addStaff: (input) => {
    const member: StaffMember = {
      id: input.id ?? `s-${Date.now()}`,
      branchId: input.branchId,
      name: input.name,
      role: input.role,
      phone: input.phone,
      email: input.email,
      password: input.password?.trim() || "demo1234",
      active: input.active ?? true,
      mustChangePassword: input.mustChangePassword ?? true,
      status: input.status ?? "off-duty",
      chairId: input.chairId ?? null,
      specialty: input.specialty ?? "",
      todaySales: 0,
      todayCommission: 0,
      todayCustomers: 0,
      monthlySales: 0,
      monthlyCommission: 0,
      monthlyTarget: input.monthlyTarget ?? 10000,
      rating: 5,
    };
    set((s) => ({
      staff: [...s.staff, member],
      staffStatuses: { ...s.staffStatuses, [member.id]: member.status },
    }));
    return member;
  },

  updateStaff: (id, patch) =>
    set((s) => {
      // A disabled staff member can't be mid-shift: free their chair and
      // clear their live status so they drop out of every barber picker
      // (POS, queue, chair assignment) rather than just showing a badge.
      const deactivating = patch.active === false;
      return {
        staff: s.staff.map((m) =>
          m.id === id
            ? {
                ...m,
                ...patch,
                status: deactivating ? "off-duty" : (patch.status ?? m.status),
                chairId: deactivating ? null : (patch.chairId ?? m.chairId),
              }
            : m,
        ),
        chairs: deactivating
          ? s.chairs.map((c) => (c.staffId === id ? { ...c, staffId: null } : c))
          : s.chairs,
        staffStatuses: deactivating
          ? { ...s.staffStatuses, [id]: "off-duty" as const }
          : s.staffStatuses,
        shifts: deactivating
          ? s.shifts.map((sh) =>
              sh.staffId === id && !sh.endedAt
                ? {
                    ...sh,
                    endedAt: new Date().toISOString(),
                    endedBy: "owner" as const,
                    note: "Account disabled",
                  }
                : sh,
            )
          : s.shifts,
      };
    }),

  addBranch: (input) => {
    const branch: Branch = {
      id: `b-${Date.now()}`,
      tenantId: "t1",
      name: input.name,
      address: input.address,
      city: input.city,
      phone: input.phone,
      status: input.status ?? "open",
      openHours: input.openHours ?? "10:00 – 22:00",
      avgWaitMins: 0,
      queueCount: 0,
      chairs: input.chairs ?? 0,
    };
    set((s) => ({ branches: [...s.branches, branch] }));
    return branch;
  },

  updateBranch: (id, patch) =>
    set((s) => ({
      branches: s.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),

  addChair: ({ branchId, label }) => {
    const existing = get().chairs.filter((c) => c.branchId === branchId);
    const number = existing.length + 1;
    const chair: Chair = {
      id: `ch-${Date.now()}`,
      branchId,
      number,
      label: label ?? `Chair ${number}`,
      staffId: null,
    };
    set((s) => ({
      chairs: [...s.chairs, chair],
      branches: s.branches.map((b) =>
        b.id === branchId ? { ...b, chairs: b.chairs + 1 } : b,
      ),
    }));
    return chair;
  },

  updateChair: (id, patch) =>
    set((s) => ({
      chairs: s.chairs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  assignChair: (chairId, staffId) =>
    set((s) => ({
      chairs: s.chairs.map((c) => {
        if (c.id === chairId) return { ...c, staffId };
        if (staffId && c.staffId === staffId) return { ...c, staffId: null };
        return c;
      }),
      staff: s.staff.map((m) => {
        if (staffId && m.id === staffId) return { ...m, chairId };
        if (m.chairId === chairId) return { ...m, chairId: null };
        return m;
      }),
    })),

  addCommissionRule: (rule) => {
    const created: CommissionRule = { ...rule, id: `cr-${Date.now()}` };
    set((s) => ({ commissionRules: [...s.commissionRules, created] }));
    return created;
  },

  updateCommissionRule: (id, patch) =>
    set((s) => ({
      commissionRules: s.commissionRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    })),

  addService: (service) => {
    const created: Service = { ...service, id: `sv-${Date.now()}` };
    set((s) => ({ services: [...s.services, created] }));
    return created;
  },

  updateService: (id, patch) =>
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)),
    })),

  addMembershipPlan: (plan) => {
    const created: MembershipPlan = { ...plan, id: `m-${Date.now()}` };
    set((s) => ({ membershipPlans: [...s.membershipPlans, created] }));
    return created;
  },

  updateMembershipPlan: (id, patch) =>
    set((s) => ({
      membershipPlans: s.membershipPlans.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })),

  deleteMembershipPlan: (id) =>
    set((s) => ({
      membershipPlans: s.membershipPlans.filter((p) => p.id !== id),
    })),

  addCustomer: (customer) => {
    const created: Customer = {
      id: `cust-${Date.now()}`,
      visits: 0,
      totalSpent: 0,
      ...customer,
    };
    set((s) => ({ customers: [created, ...s.customers] }));
    return created;
  },

  updateCustomer: (id, patch) =>
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addProduct: (product) => {
    const created: Product = { ...product, id: `p-${Date.now()}` };
    set((s) => ({ products: [...s.products, created] }));
    return created;
  },

  updateProduct: (id, patch) =>
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  addQueueTicket: (ticket) =>
    set((s) => ({
      queue: [ticket, ...s.queue],
      branches: s.branches.map((b) =>
        b.id === ticket.branchId
          ? { ...b, queueCount: b.queueCount + 1 }
          : b,
      ),
    })),

  updateQueueTicket: (id, patch) =>
    set((s) => {
      const before = s.queue.find((q) => q.id === id);
      if (!before) return {};
      const after = { ...before, ...patch };
      const queue = s.queue.map((q) => (q.id === id ? after : q));
      // Someone who leaves or no-shows takes their booking with them.
      const bookings =
        after.bookingId && (patch.status === "cancelled" || patch.status === "no-show")
          ? s.bookings.map((b) =>
              b.id === after.bookingId &&
              (b.status === "confirmed" || b.status === "checked-in")
                ? { ...b, status: patch.status as "cancelled" | "no-show" }
                : b,
            )
          : s.bookings;
      return {
        queue,
        bookings,
        ...barberSyncPatch(s, queue, [before.assignedStaffId, after.assignedStaffId]),
      };
    }),

  addBooking: (booking) =>
    set((s) => ({ bookings: [booking, ...s.bookings] })),

  updateBooking: (id, patch) =>
    set((s) => {
      const bookings = s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b));
      if (patch.status !== "cancelled" && patch.status !== "no-show") {
        return { bookings };
      }
      const status = patch.status;
      return {
        bookings,
        queue: s.queue.map((q) =>
          q.bookingId === id && (q.status === "waiting" || q.status === "called")
            ? { ...q, status }
            : q,
        ),
      };
    }),

  setPosItems: (posItems) => set({ posItems }),
  addPosItem: (item) =>
    set((s) => {
      const existing = s.posItems.find((p) => p.id === item.id);
      if (existing) {
        return {
          posItems: s.posItems.map((p) =>
            p.id === item.id
              ? { ...p, quantity: p.quantity + item.quantity }
              : p,
          ),
        };
      }
      return { posItems: [...s.posItems, item] };
    }),
  updatePosQty: (id, quantity) =>
    set((s) => ({
      posItems:
        quantity <= 0
          ? s.posItems.filter((p) => p.id !== id)
          : s.posItems.map((p) => (p.id === id ? { ...p, quantity } : p)),
    })),
  removePosItem: (id) =>
    set((s) => ({ posItems: s.posItems.filter((p) => p.id !== id) })),
  setPosDiscount: (posDiscount) => set({ posDiscount }),
  setPosDiscountMode: (posDiscountMode) => set({ posDiscountMode }),
  setPosDiscountReason: (posDiscountReason) => set({ posDiscountReason }),
  setPosTip: (posTip) => set({ posTip: Math.max(0, posTip) }),
  setPosCustomerId: (posCustomerId) => set({ posCustomerId }),
  selectPosCustomer: (id) => {
    // Changing who is paying while a ticket's services are in the cart would
    // detach the sale from that ticket (leaving it to be paid twice), so a
    // loaded ticket is dropped along with its cart.
    if (get().posTicketId) get().clearPos();
    if (!id) {
      set({ posCustomerId: null, posTicketId: null, posStaffId: null });
      return;
    }
    const ticket = get().queue.find(
      (q) =>
        q.customerId === id &&
        q.status === "awaiting-payment" &&
        q.branchId === get().branchId,
    );
    if (ticket) {
      get().loadPosTicket(ticket.id);
    } else {
      set({ posCustomerId: id, posTicketId: null, posStaffId: null });
    }
  },

  setPosMembershipPlan: (posMembershipPlanId) =>
    set((s) => {
      const member = posMembershipPlanId !== null;
      // Re-price services on the cart to match — that discount is the pitch.
      return {
        posMembershipPlanId,
        posItems: s.posItems.map((item) => {
          if (item.type !== "service") return item;
          const svc = s.services.find((v) => v.id === item.id);
          if (!svc) return item;
          return {
            ...item,
            unitPrice: member ? svc.membershipPrice : svc.price,
          };
        }),
      };
    }),
  setPosStaffId: (posStaffId) => set({ posStaffId }),

  loadPosTicket: (ticketId) =>
    set((s) => {
      const ticket = s.queue.find((q) => q.id === ticketId);
      if (!ticket) return {};
      const cust = s.customers.find((c) => c.id === ticket.customerId);
      // Always the ticket's own services — reusing whatever was already in
      // the cart would bill this customer for someone else's haircut.
      const items: PosItem[] =
        s.posTicketId === ticketId && s.posItems.length > 0
          ? s.posItems
          : ticket.serviceIds.flatMap((sid) => {
              const svc = s.services.find((v) => v.id === sid);
              if (!svc) return [];
              const price =
                cust && cust.membership !== "none"
                  ? svc.membershipPrice
                  : svc.price;
              return [
                {
                  id: svc.id,
                  type: "service" as const,
                  name: svc.name,
                  quantity: 1,
                  unitPrice: price,
                },
              ];
            });
      const switching = s.posTicketId !== ticketId;
      return {
        ...(switching
          ? {
              posDiscount: 0,
              posDiscountMode: "amount" as const,
              posDiscountReason: "",
              posTip: 0,
              posMembershipPlanId: null,
            }
          : {}),
        posTicketId: ticket.id,
        posCustomerId: ticket.customerId,
        posStaffId:
          ticket.assignedStaffId ?? ticket.preferredStaffId ?? s.posStaffId,
        posItems: items,
      };
    }),

  clearPos: () =>
    set({
      posItems: [],
      posDiscount: 0,
      posDiscountMode: "amount",
      posDiscountReason: "",
      posTip: 0,
      posCustomerId: null,
      posTicketId: null,
      posStaffId: null,
      posMembershipPlanId: null,
    }),

  completePayment: (method, card) => {
    const state = get();

    const ticket = state.posTicketId
      ? state.queue.find((q) => q.id === state.posTicketId)
      : undefined;

    const hasService = state.posItems.some((i) => i.type === "service");

    // A service is credited to a barber — the one picked on the POS, else the
    // one the ticket was assigned to, never the cashier. A product-only walk-in
    // is a plain retail sale with no barber.
    const staff =
      state.staff.find((s) => s.id === state.posStaffId) ??
      (hasService
        ? (state.staff.find(
            (s) =>
              s.id === (ticket?.assignedStaffId ?? ticket?.preferredStaffId),
          ) ??
          state.staff.find((s) => s.role === "barber") ??
          STAFF[2])
        : null);

    const crmCustomer = state.posCustomerId
      ? state.customers.find((c) => c.id === state.posCustomerId)
      : undefined;
    const customerName =
      ticket?.customerName ?? crmCustomer?.name ?? "Walk-in Customer";

    const plan = state.posMembershipPlanId
      ? state.membershipPlans.find((p) => p.id === state.posMembershipPlanId)
      : undefined;

    const items: Sale["items"] = [
      ...state.posItems.map((i, idx) => ({
        id: `pi-${idx}`,
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.unitPrice * i.quantity,
      })),
      ...(plan
        ? [
            {
              id: "pi-membership",
              type: "product" as const,
              name: `${plan.name} Membership`,
              quantity: 1,
              unitPrice: plan.price,
              total: plan.price,
            },
          ]
        : []),
    ];

    const serviceSubtotal = items
      .filter((i) => i.type === "service")
      .reduce((sum, i) => sum + i.total, 0);
    const otherSubtotal = items
      .filter((i) => i.type !== "service")
      .reduce((sum, i) => sum + i.total, 0);
    const rawDiscount =
      state.posDiscountMode === "percent"
        ? Math.round(
            (((serviceSubtotal + otherSubtotal) * state.posDiscount) / 100) *
              100,
          ) / 100
        : state.posDiscount;

    // computeCharges is the shared money math — service charge, SST and the
    // final total all come from it so every POS screen agrees.
    const charges = computeCharges({
      serviceSubtotal,
      otherSubtotal,
      discount: rawDiscount,
      tip: state.posTip,
      config: state.taxConfig,
    });
    const { goodsTotal, serviceCharge, tax, tip, total } = charges;

    // Commission is on the goods, not the tip, service charge or tax.
    const commission = staff
      ? calcCommission(
          // A membership sold on the visit isn't commissionable goods.
          Math.max(0, goodsTotal - (plan?.price ?? 0)),
          staff.id,
          state.posItems,
          state.commissionRules,
        )
      : 0;

    const sale: Sale = {
      id: `sale-${Date.now()}`,
      branchId: ticket?.branchId ?? state.branchId,
      customerId: state.posCustomerId ?? "walk-in",
      customerName,
      customerEmail: ticket?.customerEmail ?? crmCustomer?.email,
      queueTicketId: state.posTicketId ?? undefined,
      staffId: staff?.id ?? "",
      staffName: staff?.name ?? "Retail",
      items,
      subtotal: charges.subtotal,
      discount: charges.discount,
      discountReason:
        charges.discount > 0 && state.posDiscountReason.trim()
          ? state.posDiscountReason.trim()
          : undefined,
      voucher: 0,
      tip,
      serviceCharge,
      serviceChargeRate: charges.serviceChargeRate,
      tax,
      taxRate: charges.taxRate,
      total,
      paymentMethod: method,
      card: method === "card" ? card : undefined,
      commission,
      createdAt: new Date().toISOString(),
      receiptNo: `FH-KL-${Math.floor(1100 + Math.random() * 800)}`,
      rungBy: actorOf(state).name,
    };

    const soldProductIds = new Map(
      state.posItems
        .filter((i) => i.type === "product")
        .map((i) => [i.id, i.quantity] as const),
    );

    set((s) => {
      const barberTake = commission + tip;
      const cashMovement: CashMovement | null =
        method === "cash" && s.drawerSession
          ? {
              id: `cm-${Date.now()}`,
              type: "sale",
              amount: total,
              note: `${sale.receiptNo} · ${customerName}`,
              at: sale.createdAt,
              saleId: sale.id,
              by: actorOf(state).name,
            }
          : null;

      // Keep the customer's record honest: visits, spend, last visit, and any
      // membership just bought. A first-timer who left contact details is
      // remembered so they're recognised next time.
      const today = localIso(new Date(sale.createdAt));
      const soldService = items.some((i) => i.type === "service");
      const digits = (ticket?.customerPhone ?? "").replace(/\D/g, "");
      const tail = digits.slice(-9);
      const mail = ticket?.customerEmail?.trim().toLowerCase();
      const known =
        crmCustomer ??
        (ticket
          ? s.customers.find(
              (c) =>
                (mail && c.email?.toLowerCase() === mail) ||
                (digits.length >= 7 && c.phone.replace(/\D/g, "").endsWith(tail)),
            )
          : undefined);
      let customers = s.customers;
      if (known) {
        customers = s.customers.map((c) =>
          c.id === known.id
            ? {
                ...c,
                visits: c.visits + (soldService ? 1 : 0),
                totalSpent: round2(c.totalSpent + total),
                lastVisit: today,
                membership: plan ? plan.tier : c.membership,
              }
            : c,
        );
      } else if (ticket && (mail || digits.length >= 7)) {
        customers = [
          {
            id: `cust-${Date.now()}`,
            name: ticket.customerName,
            phone: ticket.customerPhone,
            email: ticket.customerEmail,
            membership: plan ? plan.tier : "none",
            visits: soldService ? 1 : 0,
            totalSpent: total,
            lastVisit: today,
          },
          ...s.customers,
        ];
      }

      const settledQueue = s.queue.map((q) =>
        q.id === state.posTicketId &&
        (q.status === "awaiting-payment" || q.status === "in-service")
          ? { ...q, status: "completed" as const }
          : q,
      );

      return {
        sales: [sale, ...s.sales],
        lastReceipt: sale,
        customers,
        bookings: ticket?.bookingId
          ? s.bookings.map((b) =>
              b.id === ticket.bookingId ? { ...b, status: "completed" as const } : b,
            )
          : s.bookings,
        posItems: [],
        posDiscount: 0,
        posDiscountMode: "amount" as const,
        posDiscountReason: "",
        posTip: 0,
        posCustomerId: null,
        posTicketId: null,
        posStaffId: null,
        posMembershipPlanId: null,
        membershipPlans: plan
          ? s.membershipPlans.map((p) =>
              p.id === plan.id ? { ...p, members: p.members + 1 } : p,
            )
          : s.membershipPlans,
        products: soldProductIds.size
          ? s.products.map((p) =>
              soldProductIds.has(p.id)
                ? {
                    ...p,
                    stock: Math.max(0, p.stock - (soldProductIds.get(p.id) ?? 0)),
                  }
                : p,
            )
          : s.products,
        drawerSession:
          cashMovement && s.drawerSession
            ? {
                ...s.drawerSession,
                movements: [...s.drawerSession.movements, cashMovement],
              }
            : s.drawerSession,
        ...barberSyncPatch(s, settledQueue, [staff?.id]),
        staff: staff
          ? (barberSyncPatch(s, settledQueue, [staff.id]).staff ?? s.staff).map((m) =>
              m.id === staff.id
                ? {
                    ...m,
                    todaySales: m.todaySales + goodsTotal,
                    todayCommission: m.todayCommission + barberTake,
                    todayCustomers: m.todayCustomers + 1,
                    monthlySales: m.monthlySales + goodsTotal,
                    monthlyCommission: m.monthlyCommission + barberTake,
                  }
                : m,
            )
          : s.staff,
        queue: settledQueue,
      };
    });

    return sale;
  },

  voidSale: (saleId, reason, by) =>
    set((s) => {
      const sale = s.sales.find((x) => x.id === saleId);
      if (!sale || sale.voided) return {};
      const at = new Date().toISOString();
      const goodsTotal =
        sale.total -
        sale.tip -
        (sale.serviceCharge ?? 0) -
        (sale.tax ?? 0);
      const barberTake = sale.commission + sale.tip;

      const refundMovement: CashMovement | null =
        sale.paymentMethod === "cash" && s.drawerSession
          ? {
              id: `cm-${Date.now()}`,
              type: "refund",
              amount: -sale.total,
              note: `Void ${sale.receiptNo} · ${reason}`,
              at,
              saleId: sale.id,
              by,
            }
          : null;

      const restock = new Map(
        sale.items
          .filter((i) => i.type === "product")
          .map((i) => [i.name, i.quantity] as const),
      );

      return {
        sales: s.sales.map((x) =>
          x.id === saleId
            ? {
                ...x,
                voided: {
                  reason,
                  at,
                  by,
                  // Cash owed back but no till open to record it against.
                  refundPending:
                    sale.paymentMethod === "cash" && !s.drawerSession ? true : undefined,
                },
              }
            : x,
        ),
        staff: s.staff.map((m) => {
          if (m.id !== sale.staffId) return m;
          // Voiding an older sale must not eat into today's or this month's figures.
          const day = localIso(new Date(sale.createdAt)) === localIso(new Date(at));
          const month = sale.createdAt.slice(0, 7) === at.slice(0, 7);
          return {
            ...m,
            todaySales: day ? Math.max(0, m.todaySales - goodsTotal) : m.todaySales,
            todayCommission: day ? Math.max(0, m.todayCommission - barberTake) : m.todayCommission,
            todayCustomers: day ? Math.max(0, m.todayCustomers - 1) : m.todayCustomers,
            monthlySales: month ? Math.max(0, m.monthlySales - goodsTotal) : m.monthlySales,
            monthlyCommission: month ? Math.max(0, m.monthlyCommission - barberTake) : m.monthlyCommission,
          };
        }),
        customers: s.customers.map((c) =>
          c.id === sale.customerId
            ? {
                ...c,
                visits: Math.max(0, c.visits - (sale.items.some((i) => i.type === "service") ? 1 : 0)),
                totalSpent: Math.max(0, round2(c.totalSpent - sale.total)),
              }
            : c,
        ),
        products: restock.size
          ? s.products.map((p) =>
              restock.has(p.name)
                ? { ...p, stock: p.stock + (restock.get(p.name) ?? 0) }
                : p,
            )
          : s.products,
        drawerSession:
          refundMovement && s.drawerSession
            ? {
                ...s.drawerSession,
                movements: [...s.drawerSession.movements, refundMovement],
              }
            : s.drawerSession,
      };
    }),

  openDrawer: ({ cashierId, cashierName, openingFloat }) => {
    const s = get();
    if (s.drawerSession) return { ok: false, error: "A drawer is already open" };
    const actor = actorOf(s);
    if (actor.role === "cashier" && actor.id) {
      const status = s.staffStatuses[actor.id];
      if (!status || status === "off-duty") {
        return { ok: false, error: "Start your shift before opening the drawer" };
      }
    }
    const float = round2(Math.max(0, openingFloat));
    const last = s.drawerHistory
      .filter(
        (d) => d.branchId === s.branchId && d.closedAt && d.countedAmount !== undefined,
      )
      .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))[0];
    const diff = last ? round2(float - (last.countedAmount ?? 0)) : 0;
    set({
      drawerSession: {
        id: `drw-${Date.now()}`,
        branchId: s.branchId,
        cashierId,
        cashierName,
        openedAt: new Date().toISOString(),
        openingFloat: float,
        movements: [],
        floatMismatch: Math.abs(diff) > DRAWER_VARIANCE_TOLERANCE ? diff : undefined,
      },
    });
    return { ok: true };
  },

  addCashMovement: ({ type, amount, note, saleId, category }) => {
    const s = get();
    const d = s.drawerSession;
    if (!d) return { ok: false, error: "No open drawer" };
    const actor = actorOf(s);
    if (actor.role === "cashier" && actor.id && actor.id !== d.cashierId) {
      return { ok: false, error: `This drawer belongs to ${d.cashierName}` };
    }
    const abs = round2(Math.abs(amount));
    if (type === "pay-out") {
      if (actor.role === "cashier" && abs > CASHIER_PAYOUT_LIMIT) {
        return {
          ok: false,
          error: `Cash out above RM${CASHIER_PAYOUT_LIMIT} needs the owner`,
        };
      }
      if (abs > drawerExpected(d)) {
        return { ok: false, error: "There isn't that much cash in the drawer" };
      }
    }
    const signed = type === "pay-out" || type === "refund" ? -abs : abs;
    set({
      drawerSession: {
        ...d,
        movements: [
          ...d.movements,
          {
            id: `cm-${Date.now()}`,
            type,
            amount: signed,
            note,
            at: new Date().toISOString(),
            saleId,
            by: actor.name,
            category,
          },
        ],
      },
    });
    return { ok: true };
  },

  closeDrawer: ({ countedAmount, denominations, closingNote }) => {
    const s = get();
    const d = s.drawerSession;
    if (!d) return { result: "forbidden", message: "No open drawer" };
    const actor = actorOf(s);
    const isOwner = actor.role === "owner";
    if (!isOwner && actor.id && actor.id !== d.cashierId) {
      return {
        result: "forbidden",
        message: `Only ${d.cashierName} can close this drawer`,
      };
    }
    const awaiting = s.queue.filter(
      (q) => q.branchId === d.branchId && q.status === "awaiting-payment",
    ).length;
    if (awaiting > 0 && !isOwner) {
      return {
        result: "blocked",
        message: `${awaiting} customer${awaiting > 1 ? "s are" : " is"} still awaiting payment — take payment first`,
      };
    }

    const expected = drawerExpected(d);
    const counted = round2(Math.max(0, countedAmount));
    const variance = round2(counted - expected);
    const within = Math.abs(variance) <= DRAWER_VARIANCE_TOLERANCE;
    const now = new Date().toISOString();
    const counts = [...(d.counts ?? []), { amount: counted, at: now, denominations }];
    const reason = closingNote?.trim() ?? "";

    let status: "closed" | "needs-review" = "closed";
    if (!isOwner && !within) {
      if (counts.length === 1) {
        set({ drawerSession: { ...d, counts } });
        return { result: "recount" };
      }
      if (reason.length < MIN_VARIANCE_REASON) {
        set({ drawerSession: { ...d, counts } });
        return { result: "reason-required" };
      }
      status = "needs-review";
    }

    const closed: DrawerSession = {
      ...d,
      closedAt: now,
      closedBy: actor.name,
      closedByOwner: isOwner || undefined,
      countedAmount: counted,
      denominations,
      counts,
      expectedAtClose: expected,
      variance,
      status,
      closingNote: reason || undefined,
      varianceReason: !within && reason ? reason : undefined,
    };
    set({ drawerSession: null, drawerHistory: [closed, ...s.drawerHistory] });
    return { result: status };
  },

  reviewDrawer: (id, note) => {
    const s = get();
    const actor = actorOf(s);
    if (actor.role !== "owner") {
      return { ok: false, error: "Only the owner can review a drawer" };
    }
    set({
      drawerHistory: s.drawerHistory.map((d) =>
        d.id === id
          ? {
              ...d,
              status: "reviewed" as const,
              reviewedBy: actor.name,
              reviewedAt: new Date().toISOString(),
              reviewNote: note.trim() || undefined,
            }
          : d,
      ),
    });
    return { ok: true };
  },

  setTrackingTicketId: (trackingTicketId) => set({ trackingTicketId }),
  setTrackingBookingId: (trackingBookingId) => set({ trackingBookingId }),
}));

/** Cash the drawer should hold right now: opening float plus every movement. */
export function drawerExpected(session: DrawerSession): number {
  return (
    session.openingFloat +
    session.movements.reduce((sum, m) => sum + m.amount, 0)
  );
}

/**
 * The address customers should be sent to. `NEXT_PUBLIC_APP_URL` wins so a QR
 * printed from any machine (even localhost) still points at the live site.
 */
export function publicOrigin(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return fromEnv || undefined;
}

/** True for addresses only this computer or its network can open. */
export function isPrivateOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(origin);
}

/** Advance-booking page for one branch — safe to share as a link or QR. */
export function getBranchBookingUrl(branchId: string, origin?: string) {
  const base =
    origin ??
    publicOrigin() ??
    (typeof window !== "undefined" ? window.location.origin : "https://barberflow.app");
  return `${base}/customer/booking?branch=${branchId}`;
}

export function getBranchJoinUrl(branchId: string, origin?: string) {
  const base =
    origin ??
    publicOrigin() ??
    (typeof window !== "undefined" ? window.location.origin : "https://barberflow.app");
  return `${base}/join/${branchId}`;
}
