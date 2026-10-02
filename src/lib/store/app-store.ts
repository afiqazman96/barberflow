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
  PosItem,
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
import { DEFAULT_TAX_CONFIG } from "@/lib/pos-pricing";
import { isPrivateOrigin, publicOrigin } from "@/lib/public-origin";
import { pushTicketPatch, requestQueueRefetch } from "@/lib/queue/client";
import type { QueueSnapshot } from "@/lib/queue/dto";
import { pushBookingStatus } from "@/lib/bookings/client";
import type { BookingsSnapshot } from "@/lib/bookings/dto";
import { pushOwnStatus } from "@/lib/staff/client";
import {
  pushClockIn,
  pushClockOut,
  pushLeave,
  pushOpsRules,
  pushRemoveLeave,
  pushBusinessProfile,
  pushCommissionRuleActive,
  pushNewCommissionRule,
  pushRosterDay,
  pushTaxConfig,
} from "@/lib/shop/client";
import type { ShopSnapshot } from "@/lib/shop/dto";
import {
  pushMembershipPlan,
  pushNewProduct,
  pushNewService,
  pushProductPatch,
  pushRemoveMembershipPlan,
  pushServicePatch,
  pushStockChange,
  saveCustomerPatch,
  saveNewCustomer,
} from "@/lib/catalog/client";
import { checkout, voidSale as voidSaleOnServer } from "@/lib/sales/actions";
import {
  addCashMovement as addCashMovementOnServer,
  closeDrawer as closeDrawerOnServer,
  openDrawer as openDrawerOnServer,
  reviewDrawer as reviewDrawerOnServer,
} from "@/lib/sales/drawer-actions";
import type { CloseDrawerResult, SalesSnapshot } from "@/lib/sales/dto";

export { isPrivateOrigin, publicOrigin };
import { emptyWeek, localIso, openShiftOf } from "@/lib/roster";

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
  /**
   * One per bill, kept until it is paid or cleared: a retry after a dropped
   * connection reuses it, so the server can't charge the bill twice.
   */
  posCheckoutKey: string | null;
  lastReceipt: Sale | null;
  /** The open till at the branch being viewed, or null when it is closed. */
  drawerSession: DrawerSession | null;
  /** Every open till this person may see; `drawerSession` is picked from it. */
  openDrawers: DrawerSession[];
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
  /** Saved on the server before it appears; a duplicate phone or email is refused. */
  addCustomer: (
    customer: Omit<Customer, "id" | "visits" | "totalSpent"> & Partial<Customer>,
  ) => Promise<{ ok: true; customer: Customer } | { ok: false; error: string }>;
  updateCustomer: (
    id: string,
    patch: Partial<Customer>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  addProduct: (product: Omit<Product, "id">) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  /**
   * Replace the queue for the branches a server snapshot covers. The database
   * is the source of truth for tickets; this store is a read-through mirror
   * kept live by `<QueueSync>`.
   */
  hydrateQueue: (snapshot: QueueSnapshot) => void;
  /** Mirror a ticket the server has just issued. */
  addQueueTicket: (ticket: QueueTicket) => void;
  /** Apply a change locally and persist it (staff screens). */
  updateQueueTicket: (id: string, patch: Partial<QueueTicket>) => void;
  /** Apply a change locally only — the caller has already persisted it. */
  applyQueueTicketPatch: (id: string, patch: Partial<QueueTicket>) => void;
  /** Replace the covered branches' appointments with the database's. */
  hydrateBookings: (snapshot: BookingsSnapshot) => void;
  /** Rules, roster, leave, shifts and chairs from the database. */
  hydrateShop: (snapshot: ShopSnapshot) => void;
  /** Replace the covered sales with the database's, and the staff totals with them. */
  hydrateSales: (snapshot: SalesSnapshot) => void;
  /** Add a booking the server has just created. */
  addBooking: (booking: Booking) => void;
  /** Apply a status change locally and persist it (staff screens). */
  updateBooking: (id: string, patch: Partial<Booking>) => void;
  /** Apply a change locally only — the caller has already persisted it. */
  applyBookingPatch: (id: string, patch: Partial<Booking>) => void;
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
  /**
   * Take payment for what is on the POS. The server prices the bill and
   * records the sale; only then does this device show it.
   */
  completePayment: (
    method: PaymentMethod,
    card?: Sale["card"],
  ) => Promise<{ ok: true; sale: Sale } | { ok: false; error: string }>;
  voidSale: (saleId: string, reason: string, by: string) => Promise<{ ok: boolean; error?: string }>;
  /** Open the till at the branch being viewed, as the signed-in person. */
  openDrawer: (input: {
    cashierId: string;
    cashierName: string;
    openingFloat: number;
  }) => Promise<{ ok: boolean; error?: string }>;
  addCashMovement: (input: {
    type: CashMovement["type"];
    amount: number;
    note: string;
    saleId?: string;
    category?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /**
   * Close the drawer from a count. The cashier is never told the expected
   * figure or the variance: a count that is off is bounced for one recount,
   * then needs a written reason and goes to the owner for review.
   */
  closeDrawer: (input: {
    countedAmount: number;
    denominations?: Record<string, number>;
    closingNote?: string;
  }) => Promise<{ result: CloseDrawerResult; message?: string }>;
  /** Owner signs off a close that came in outside tolerance. */
  reviewDrawer: (id: string, note: string) => Promise<{ ok: boolean; error?: string }>;
  setTrackingTicketId: (id: string | null) => void;
  setTrackingBookingId: (id: string | null) => void;
}

// The commission maths lives with the server's copy of the same rules.
export { calcCommission } from "@/lib/commission";


export type { CloseDrawerResult } from "@/lib/sales/dto";

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

/**
 * Lay the database's statuses over the store's. A recorded `available` does
 * not demote someone this device knows is mid-service; `barberSyncPatch`
 * settles busy against the tickets right after.
 */
function withRecordedStatuses(
  s: AppState,
  recorded: Record<string, StaffStatus>,
): AppState {
  let statuses = s.staffStatuses;
  for (const [id, status] of Object.entries(recorded)) {
    const cur = statuses[id];
    if (cur === status || (cur === "busy" && status === "available")) continue;
    statuses = { ...statuses, [id]: status };
  }
  if (statuses === s.staffStatuses) return s;
  return {
    ...s,
    staffStatuses: statuses,
    staff: s.staff.map((m) =>
      statuses[m.id] && statuses[m.id] !== m.status
        ? { ...m, status: statuses[m.id] }
        : m,
    ),
  };
}

/** The status change is the signed-in person's own, so it is theirs to record. */
function isOwnStatus(s: AppState, staffId: string): boolean {
  if (!s.session || s.session.staffId !== staffId) return false;
  return s.staff.find((m) => m.id === staffId)?.role !== "owner";
}

/** Everything that changes when someone clocks out, or is forced out. */
function closeShiftPatch(
  s: AppState,
  staffId: string,
  by: "self" | "owner" | "auto",
  note?: string,
): Partial<AppState> {
  const at = new Date().toISOString();
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
  // From the database (`hydrateShop`), like the team, branches and chairs.
  businessProfile: { name: "", phone: "", email: "", address: "", taxId: "" },
  taxConfig: { ...DEFAULT_TAX_CONFIG },
  opsRules: {
    gracePeriodMins: 10,
    maxWaitMins: 45,
    advanceDays: 7,
    cancelHours: 4,
    slotInterval: 30,
  },
  // Filled by `<QueueSync>` from the database — never from mock data, so a
  // lobby screen cannot flash tickets that do not exist.
  queue: [],
  // Filled by `<QueueSync bookings>` from the database, like the queue.
  bookings: [],
  // From the database (`hydrateSales`); nothing until the first snapshot.
  sales: [],
  staff: [],
  branches: [],
  chairs: [],
  // From the database (`hydrateShop`); nothing until the first snapshot.
  commissionRules: [],
  services: [],
  membershipPlans: [],
  products: [],
  customers: [],
  staffStatuses: {},
  // Shifts, roster and leave are filled by `<QueueSync>` from the database.
  shifts: [],
  roster: {},
  leaves: [],
  posItems: [],
  posDiscount: 0,
  posDiscountMode: "amount",
  posDiscountReason: "",
  posTip: 0,
  posCustomerId: null,
  posTicketId: null,
  posStaffId: null,
  posMembershipPlanId: null,
  posCheckoutKey: null,
  drawerSession: null,
  openDrawers: [],
  // From the database (`hydrateSales`).
  drawerHistory: [],
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
            posCheckoutKey: null,
            drawerSession: s.openDrawers.find((d) => d.branchId === branchId) ?? null,
          },
    ),
  updateBusinessProfile: (patch) => {
    set((s) => ({
      businessProfile: { ...s.businessProfile, ...patch },
    }));
    const profile = get().businessProfile;
    pushBusinessProfile({
      ...profile,
      // Removed on the screen is `undefined`; over the wire that reads as
      // "unchanged", so send `null`.
      logoUrl: "logoUrl" in patch ? (patch.logoUrl ?? null) : profile.logoUrl,
    });
  },
  updateTaxConfig: (patch) => {
    set((s) => ({ taxConfig: { ...s.taxConfig, ...patch } }));
    pushTaxConfig(get().taxConfig);
  },
  updateOpsRules: (patch) => {
    set((s) => ({ opsRules: { ...s.opsRules, ...patch } }));
    pushOpsRules(get().opsRules);
  },

  updateStaffStatus: (staffId, status) => {
    const before = get().staffStatuses[staffId];
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
    });
    const after = get().staffStatuses[staffId];
    if (after !== before && isOwnStatus(get(), staffId)) {
      // Going off duty here is ending the shift (`closeShiftPatch` above).
      if (after === "off-duty") pushClockOut(staffId, { self: true });
      else pushOwnStatus(after);
    }
  },

  startShift: (staffId, opts) => {
    const s = get();
    const m = s.staff.find((x) => x.id === staffId);
    if (!m || !m.active) return { ok: false, error: "This account is disabled" };
    if (m.role === "owner") return { ok: false, error: "Owners do not clock in" };
    if (openShiftOf(s.shifts, staffId)) {
      // The shift is open on this device but the status says otherwise — it
      // was recorded off duty elsewhere. Clocking in again puts them back.
      if ((s.staffStatuses[staffId] ?? m.status) === "off-duty") {
        set((st) => ({
          staffStatuses: { ...st.staffStatuses, [staffId]: "available" },
          staff: st.staff.map((x) =>
            x.id === staffId ? { ...x, status: "available" as const } : x,
          ),
        }));
        pushClockIn(staffId, {
          self: get().session?.staffId === staffId,
          chairId: opts?.chairId,
          note: opts?.note,
        });
      }
      return { ok: true };
    }

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
    pushClockIn(staffId, {
      self: get().session?.staffId === staffId,
      chairId,
      note: opts?.note,
    });
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
    // The server makes the same release of customers who asked for them.
    pushClockOut(staffId, {
      self: get().session?.staffId === staffId,
      note: opts?.note,
    });
    return { ok: true };
  },

  setRosterDay: (staffId, weekday, patch) => {
    set((s) => ({
      roster: {
        ...s.roster,
        [staffId]: (s.roster[staffId] ?? emptyWeek()).map((d, i) =>
          i === weekday ? { ...d, ...patch } : d,
        ),
      },
    }));
    const day = get().roster[staffId]?.[weekday];
    if (day) pushRosterDay(staffId, weekday, day);
  },

  addLeave: (input) => {
    set((s) => ({
      leaves: [
        { id: `lv-${Date.now()}`, ...input },
        ...s.leaves.filter((l) => !(l.staffId === input.staffId && l.date === input.date)),
      ],
    }));
    pushLeave(input);
  },

  removeLeave: (id) => {
    const leave = get().leaves.find((l) => l.id === id);
    set((s) => ({ leaves: s.leaves.filter((l) => l.id !== id) }));
    // By person and date: a leave added a moment ago still has its local id.
    if (leave) pushRemoveLeave(leave.staffId, leave.date);
  },

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
    pushNewCommissionRule(rule);
    return created;
  },

  updateCommissionRule: (id, patch) => {
    set((s) => ({
      commissionRules: s.commissionRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
    // Switching a rule on or off is the only edit the screen offers.
    if (patch.active !== undefined) pushCommissionRuleActive(id, patch.active);
  },

  // The catalogue and customers are the database's; each change shows here at
  // once and is persisted (`catalog/client.ts`). A new row carries a temporary
  // id until the refetch its write triggers brings the stored one.
  addService: (service) => {
    const created: Service = { ...service, id: `sv-${Date.now()}` };
    set((s) => ({ services: [...s.services, created] }));
    pushNewService(service);
    return created;
  },

  updateService: (id, patch) => {
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)),
    }));
    pushServicePatch(id, patch);
  },

  addMembershipPlan: (plan) => {
    const created: MembershipPlan = { ...plan, id: `m-${Date.now()}` };
    set((s) => ({ membershipPlans: [...s.membershipPlans, created] }));
    pushMembershipPlan(null, plan);
    return created;
  },

  updateMembershipPlan: (id, patch) => {
    set((s) => ({
      membershipPlans: s.membershipPlans.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
    const plan = get().membershipPlans.find((p) => p.id === id);
    if (plan) pushMembershipPlan(id, plan);
  },

  deleteMembershipPlan: (id) => {
    set((s) => ({
      membershipPlans: s.membershipPlans.filter((p) => p.id !== id),
    }));
    pushRemoveMembershipPlan(id);
  },

  // Unlike the rest of the catalogue, saved first and shown after: see
  // `saveNewCustomer`.
  addCustomer: async (customer) => {
    const result = await saveNewCustomer(customer);
    if (!result.ok) return result;
    const created: Customer = {
      id: result.data.id,
      visits: 0,
      totalSpent: 0,
      ...customer,
    };
    set((s) => ({
      customers: [created, ...s.customers.filter((c) => c.id !== created.id)],
    }));
    return { ok: true, customer: created };
  },

  updateCustomer: async (id, patch) => {
    const result = await saveCustomerPatch(id, patch);
    if (!result.ok) return result;
    set((s) => ({
      customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    return { ok: true };
  },

  addProduct: (product) => {
    const created: Product = { ...product, id: `p-${Date.now()}` };
    set((s) => ({ products: [...s.products, created] }));
    pushNewProduct(product);
    return created;
  },

  updateProduct: (id, patch) => {
    const before = get().products.find((p) => p.id === id);
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    const { stock, ...details } = patch;
    // Stock goes up as a change, not a total, so it can't undo a sale.
    if (stock !== undefined && before && stock !== before.stock) {
      pushStockChange(id, stock - before.stock);
    }
    if (Object.keys(details).length > 0) pushProductPatch(id, details);
  },

  hydrateQueue: ({ tickets, branchIds, ownTicketId, staffStatuses }) =>
    set((st) => {
      // Breaks and shifts recorded on other devices. Applied first, so the
      // busy/available derivation below works from what everyone else sees.
      const s = staffStatuses ? withRecordedStatuses(st, staffStatuses) : st;
      const covered = new Set(branchIds);
      const queue = [
        ...tickets,
        ...s.queue.filter((q) => !covered.has(q.branchId)),
      ];
      // Reconcile everyone at the branches this snapshot speaks for, not just
      // the barbers named on a ticket: someone marked busy with no ticket in
      // service (a stale flag, or a service finished on another device) has
      // no ticket left to be found through.
      const barbers = new Set<string | null>([
        ...s.staff.filter((m) => covered.has(m.branchId)).map((m) => m.id),
        ...[...s.queue, ...queue].map((q) => q.assignedStaffId),
      ]);
      return {
        queue,
        branches: s.branches.map((b) =>
          covered.has(b.id)
            ? {
                ...b,
                queueCount: queue.filter(
                  (q) =>
                    q.branchId === b.id &&
                    (q.status === "waiting" || q.status === "called"),
                ).length,
              }
            : b,
        ),
        ...(ownTicketId ? { trackingTicketId: ownTicketId } : {}),
        staffStatuses: s.staffStatuses,
        staff: s.staff,
        ...barberSyncPatch(s, queue, barbers),
      };
    }),

  addQueueTicket: (ticket) =>
    set((s) => {
      // The Realtime poke for this same ticket may have landed first.
      if (s.queue.some((q) => q.id === ticket.id)) {
        return { queue: s.queue.map((q) => (q.id === ticket.id ? ticket : q)) };
      }
      return {
        queue: [ticket, ...s.queue],
        branches: s.branches.map((b) =>
          b.id === ticket.branchId
            ? { ...b, queueCount: b.queueCount + 1 }
            : b,
        ),
      };
    }),

  updateQueueTicket: (id, patch) => {
    if (!get().queue.some((q) => q.id === id)) return;
    get().applyQueueTicketPatch(id, patch);
    pushTicketPatch(id, patch);
  },

  applyQueueTicketPatch: (id, patch) =>
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

  hydrateBookings: ({ bookings: incoming, branchIds, ownBookingId }) =>
    set((s) => {
      const covered = new Set(branchIds);
      const incomingIds = new Set(incoming.map((b) => b.id));
      return {
        bookings: [
          ...incoming,
          ...s.bookings.filter(
            (b) => !covered.has(b.branchId) && !incomingIds.has(b.id),
          ),
        ],
        ...(ownBookingId ? { trackingBookingId: ownBookingId } : {}),
      };
    }),

  hydrateShop: ({
    opsRules,
    roster,
    leaves,
    shifts,
    staffChairs,
    branchIds,
    taxConfig,
    commissionRules,
    services,
    products,
    membershipPlans,
    customers,
    team,
    branches,
    chairs,
    businessProfile,
  }) =>
    set((s) => {
      const covered = new Set(branchIds);

      // The team the snapshot speaks for replaces this device's copy. Sales
      // figures stay (they are `hydrateSales`'s), and so does a status the
      // queue snapshot recorded — `busy` is derived there, not stored.
      const before = new Map(s.staff.map((m) => [m.id, m]));
      const incoming = new Set((team ?? []).map((m) => m.id));
      const nextStaff = team
        ? [
            ...team.map((m) => {
              const old = before.get(m.id);
              return {
                ...m,
                status: s.staffStatuses[m.id] ?? old?.status ?? m.status,
                todaySales: old?.todaySales ?? 0,
                todayCommission: old?.todayCommission ?? 0,
                todayCustomers: old?.todayCustomers ?? 0,
                monthlySales: old?.monthlySales ?? 0,
                monthlyCommission: old?.monthlyCommission ?? 0,
              };
            }),
            // Elsewhere in the shop, for a snapshot that speaks for one branch.
            ...s.staff.filter(
              (m) => !incoming.has(m.id) && m.branchId !== "" && !covered.has(m.branchId),
            ),
          ]
        : s.staff;
      const nextChairs = chairs
        ? [...chairs, ...s.chairs.filter((c) => !covered.has(c.branchId))]
        : s.chairs;
      // An owner looking at a branch that no longer exists moves to the first.
      const branchId =
        branches?.length && !branches.some((b) => b.id === s.branchId) && s.session?.role === "owner"
          ? branches[0].id
          : s.branchId;
      // Everyone the snapshot speaks for, rostered or not.
      const people = new Set(Object.keys(staffChairs));

      const nextRoster = Object.fromEntries(
        Object.entries(s.roster).filter(([id]) => !people.has(id)),
      );
      Object.assign(nextRoster, roster);

      // The chairs the database has people at; a chair nobody holds is free.
      const holderOf = new Map<string, string>();
      for (const [staffId, chairId] of Object.entries(staffChairs)) {
        if (chairId) holderOf.set(chairId, staffId);
      }

      return {
        opsRules,
        ...(branches ? { branches } : {}),
        ...(businessProfile ? { businessProfile } : {}),
        ...(branchId !== s.branchId
          ? {
              branchId,
              drawerSession: s.openDrawers.find((d) => d.branchId === branchId) ?? null,
            }
          : {}),
        // Staff snapshots only; a customer's screen keeps the defaults.
        ...(taxConfig ? { taxConfig } : {}),
        ...(commissionRules ? { commissionRules } : {}),
        // Older snapshots in flight during a deploy may lack it.
        ...(services ? { services } : {}),
        ...(products ? { products } : {}),
        ...(membershipPlans ? { membershipPlans } : {}),
        ...(customers ? { customers } : {}),
        roster: nextRoster,
        leaves: [...leaves, ...s.leaves.filter((l) => !people.has(l.staffId))],
        // A public snapshot carries no shifts; keep whatever this device has.
        shifts:
          shifts.length > 0 || s.session
            ? [...shifts, ...s.shifts.filter((sh) => !covered.has(sh.branchId))]
            : s.shifts,
        staff: nextStaff.map((m) =>
          people.has(m.id) && m.chairId !== staffChairs[m.id]
            ? { ...m, chairId: staffChairs[m.id] }
            : m,
        ),
        chairs: nextChairs.map((c) =>
          covered.has(c.branchId) && c.staffId !== (holderOf.get(c.id) ?? null)
            ? { ...c, staffId: holderOf.get(c.id) ?? null }
            : c,
        ),
      };
    }),

  hydrateSales: ({ sales: incoming, branchIds, onlyStaffId, drawers }) =>
    set((s) => {
      const covered = new Set(branchIds);
      // A barber's snapshot is only their own sales; leave anyone else's be.
      const isCovered = (sale: Sale) =>
        covered.has(sale.branchId) && (!onlyStaffId || sale.staffId === onlyStaffId);

      // The figures on each person's card, from the same sales the screens list.
      // Takings are the goods (no tip, service charge or SST); their take is
      // commission plus tips, as at the till.
      const today = localIso(new Date());
      const month = today.slice(0, 7);
      const zero = {
        todaySales: 0,
        todayCommission: 0,
        todayCustomers: 0,
        monthlySales: 0,
        monthlyCommission: 0,
      };
      const totals = new Map<string, typeof zero>();
      for (const sale of incoming) {
        if (sale.voided || !sale.staffId || sale.createdAt.slice(0, 7) !== month) continue;
        const t = totals.get(sale.staffId) ?? { ...zero };
        const goods = round2(sale.total - sale.tip - (sale.serviceCharge ?? 0) - (sale.tax ?? 0));
        const take = round2(sale.commission + sale.tip);
        t.monthlySales = round2(t.monthlySales + goods);
        t.monthlyCommission = round2(t.monthlyCommission + take);
        if (sale.createdAt.slice(0, 10) === today) {
          t.todaySales = round2(t.todaySales + goods);
          t.todayCommission = round2(t.todayCommission + take);
          t.todayCustomers += 1;
        }
        totals.set(sale.staffId, t);
      }
      const counted = (m: StaffMember) =>
        onlyStaffId ? m.id === onlyStaffId : covered.has(m.branchId);

      const tills = drawers
        ? (() => {
            const openDrawers = [
              ...drawers.open,
              ...s.openDrawers.filter((d) => !covered.has(d.branchId)),
            ];
            return {
              openDrawers,
              drawerSession: openDrawers.find((d) => d.branchId === s.branchId) ?? null,
              drawerHistory: [
                ...drawers.history,
                ...s.drawerHistory.filter((d) => !covered.has(d.branchId)),
              ],
            };
          })()
        : {};

      return {
        ...tills,
        sales: [...incoming, ...s.sales.filter((x) => !isCovered(x))],
        staff: s.staff.map((m) =>
          counted(m) ? { ...m, ...(totals.get(m.id) ?? zero) } : m,
        ),
      };
    }),

  addBooking: (booking) =>
    set((s) => ({
      // The Realtime poke for this same booking may have landed first.
      bookings: [booking, ...s.bookings.filter((b) => b.id !== booking.id)],
    })),

  updateBooking: (id, patch) => {
    if (!get().bookings.some((b) => b.id === id)) return;
    get().applyBookingPatch(id, patch);
    // The server takes a checked-in ticket with a cancelled or missed booking.
    if (patch.status && get().session) pushBookingStatus(id, patch.status);
  },

  applyBookingPatch: (id, patch) =>
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
              posCheckoutKey: null,
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
      posCheckoutKey: null,
    }),

  completePayment: async (method, card) => {
    const state = get();

    const ticket = state.posTicketId
      ? state.queue.find((q) => q.id === state.posTicketId)
      : undefined;

    // A service is credited to a barber — the one picked on the POS, else the
    // one the ticket was assigned to, never the cashier. A product-only walk-in
    // is a plain retail sale with no barber. The server checks the choice.
    const hasService = state.posItems.some((i) => i.type === "service");
    const staffId =
      state.posStaffId ??
      (hasService ? (ticket?.assignedStaffId ?? ticket?.preferredStaffId ?? null) : null);

    const crmCustomer = state.posCustomerId
      ? state.customers.find((c) => c.id === state.posCustomerId)
      : undefined;
    const plan = state.posMembershipPlanId
      ? state.membershipPlans.find((p) => p.id === state.posMembershipPlanId)
      : undefined;

    const idempotencyKey = state.posCheckoutKey ?? crypto.randomUUID();
    if (!state.posCheckoutKey) set({ posCheckoutKey: idempotencyKey });

    let result: Awaited<ReturnType<typeof checkout>>;
    try {
      result = await checkout({
        branchId: ticket?.branchId ?? state.branchId,
        ticketId: state.posTicketId,
        customerId: state.posCustomerId,
        customerName: crmCustomer?.name,
        customerEmail: crmCustomer?.email,
        staffId,
        items: state.posItems.map((i) => ({
          id: i.id,
          type: i.type,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        membershipPlanId: state.posMembershipPlanId,
        discount: {
          mode: state.posDiscountMode,
          value: state.posDiscount,
          reason: state.posDiscountReason,
        },
        tip: state.posTip,
        method,
        card,
        idempotencyKey,
      });
    } catch {
      return {
        ok: false,
        error: "Check your connection and try again — nothing was charged twice",
      };
    }
    if (!result.ok) return result;
    const sale = result.sale;
    const items = sale.items;
    // Whoever the server credited, which is the figure that counts.
    const staff = state.staff.find((m) => m.id === sale.staffId);

    const soldProductIds = new Map(
      state.posItems
        .filter((i) => i.type === "product")
        .map((i) => [i.id, i.quantity] as const),
    );

    set((s) => {
      const barberTake = round2(sale.commission + sale.tip);
      const goodsTotal = round2(
        sale.total - sale.tip - (sale.serviceCharge ?? 0) - (sale.tax ?? 0),
      );

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
                totalSpent: round2(c.totalSpent + sale.total),
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
            totalSpent: sale.total,
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
        // The Realtime poke for this sale may have landed first.
        sales: [sale, ...s.sales.filter((x) => x.id !== sale.id)],
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
        posCheckoutKey: null,
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

    return { ok: true, sale };
  },

  voidSale: async (saleId, reason, by) => {
    const target = get().sales.find((x) => x.id === saleId);
    if (!target || target.voided) {
      return { ok: false, error: "That sale has already been voided" };
    }
    let result: Awaited<ReturnType<typeof voidSaleOnServer>>;
    try {
      // The refund comes out of the branch's open till, or is flagged for later.
      result = await voidSaleOnServer(saleId, reason);
    } catch {
      return { ok: false, error: "Check your connection and try again" };
    }
    if (!result.ok) return result;

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
      };
    });
    return { ok: true };
  },

  // The till's rules are the server's (`sales/drawer-actions.ts`); each write
  // is followed by a re-read, since its Realtime poke can trail the reply.
  openDrawer: async ({ openingFloat }) => {
    try {
      const result = await openDrawerOnServer({ branchId: get().branchId, openingFloat });
      if (result.ok) requestQueueRefetch();
      return result;
    } catch {
      return { ok: false, error: "Check your connection and try again" };
    }
  },

  addCashMovement: async ({ type, amount, note, category }) => {
    if (type !== "pay-in" && type !== "pay-out") {
      return { ok: false, error: "Only cash in and cash out are recorded here" };
    }
    try {
      const result = await addCashMovementOnServer({
        branchId: get().branchId,
        type,
        amount,
        note,
        category,
      });
      if (result.ok) requestQueueRefetch();
      return result;
    } catch {
      return { ok: false, error: "Check your connection and try again" };
    }
  },

  closeDrawer: async ({ countedAmount, denominations, closingNote }) => {
    try {
      const result = await closeDrawerOnServer({
        branchId: get().branchId,
        countedAmount,
        denominations,
        closingNote,
      });
      if (result.result === "closed" || result.result === "needs-review") {
        // Gone at once; the re-read brings it back as history.
        set((s) => ({
          drawerSession: null,
          openDrawers: s.openDrawers.filter((d) => d.branchId !== s.branchId),
        }));
      }
      requestQueueRefetch();
      return result;
    } catch {
      return { result: "forbidden", message: "Check your connection and try again" };
    }
  },

  reviewDrawer: async (id, note) => {
    try {
      const result = await reviewDrawerOnServer(id, note);
      if (result.ok) requestQueueRefetch();
      return result;
    } catch {
      return { ok: false, error: "Check your connection and try again" };
    }
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
