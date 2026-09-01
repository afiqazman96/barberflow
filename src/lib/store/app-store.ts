"use client";

import { create } from "zustand";

import type { SessionUser } from "@/lib/auth/dto";
import type {
  Booking,
  Branch,
  BusinessProfile,
  Chair,
  CommissionRule,
  MembershipPlan,
  PaymentMethod,
  Product,
  QueueTicket,
  Sale,
  Service,
  StaffMember,
  StaffStatus,
  UserRole,
} from "@/lib/types";
import {
  BOOKINGS,
  BRANCHES,
  CHAIRS,
  COMMISSION_RULES,
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
  staffStatuses: Record<string, StaffStatus>;
  posItems: PosItem[];
  posDiscount: number;
  posCustomerId: string | null;
  lastReceipt: Sale | null;
  trackingTicketId: string | null;

  setSession: (session: SessionUser | null) => void;
  setRole: (role: UserRole | null, staffId?: string | null) => void;
  setBranchId: (id: string) => void;
  updateBusinessProfile: (patch: Partial<BusinessProfile>) => void;
  updateStaffStatus: (staffId: string, status: StaffStatus) => void;
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
  setPosCustomerId: (id: string | null) => void;
  clearPos: () => void;
  completePayment: (method: PaymentMethod) => Sale;
  setTrackingTicketId: (id: string | null) => void;
}

function calcCommission(
  total: number,
  staffId: string,
  items: PosItem[],
  rules: CommissionRule[],
): number {
  const active = rules.filter((r) => r.active);
  const staffOverride = active.find(
    (r) => r.staffId === staffId && r.type === "percentage" && r.appliesTo === "all",
  );
  if (staffOverride) {
    return Math.round(total * (staffOverride.value / 100) * 100) / 100;
  }

  let commission = 0;
  for (const item of items) {
    const line = item.unitPrice * item.quantity;
    const typeRules = active.filter((r) => {
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

    const pct =
      typeRules.find((r) => r.type === "percentage" || r.type === "service-based" || r.type === "product-based")
        ?.value ?? 30;
    const fixed = typeRules
      .filter((r) => r.type === "fixed")
      .reduce((sum, r) => sum + r.value * item.quantity, 0);

    commission += line * (pct / 100) + fixed;
  }

  return Math.round(commission * 100) / 100;
}

const initialStatuses = Object.fromEntries(
  STAFF.map((s) => [s.id, s.status]),
) as Record<string, StaffStatus>;

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
  staffStatuses: initialStatuses,
  posItems: [],
  posDiscount: 0,
  posCustomerId: null,
  lastReceipt: null,
  trackingTicketId: null,

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
  setBranchId: (branchId) => set({ branchId }),
  updateBusinessProfile: (patch) =>
    set((s) => ({
      businessProfile: { ...s.businessProfile, ...patch },
    })),

  updateStaffStatus: (staffId, status) =>
    set((s) => ({
      staffStatuses: { ...s.staffStatuses, [staffId]: status },
      staff: s.staff.map((m) => (m.id === staffId ? { ...m, status } : m)),
    })),

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
      id: `s-${Date.now()}`,
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
    set((s) => ({
      staff: s.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

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
    set((s) => ({
      queue: s.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    })),

  addBooking: (booking) =>
    set((s) => ({ bookings: [booking, ...s.bookings] })),

  updateBooking: (id, patch) =>
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),

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
  setPosCustomerId: (posCustomerId) => set({ posCustomerId }),
  clearPos: () => set({ posItems: [], posDiscount: 0, posCustomerId: null }),

  completePayment: (method) => {
    const state = get();
    const subtotal = state.posItems.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );
    const total = Math.max(0, subtotal - state.posDiscount);
    const staff =
      state.staff.find((s) => s.id === state.staffId) ??
      state.staff.find((s) => s.role === "barber") ??
      STAFF[2];
    const commission = calcCommission(
      total,
      staff.id,
      state.posItems,
      state.commissionRules,
    );
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      branchId: state.branchId,
      customerId: state.posCustomerId ?? "walk-in",
      customerName:
        state.queue.find((q) => q.customerId === state.posCustomerId)
          ?.customerName ?? "Walk-in Customer",
      staffId: staff.id,
      staffName: staff.name,
      items: state.posItems.map((i, idx) => ({
        id: `pi-${idx}`,
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.unitPrice * i.quantity,
      })),
      subtotal,
      discount: state.posDiscount,
      voucher: 0,
      total,
      paymentMethod: method,
      commission,
      createdAt: new Date().toISOString(),
      receiptNo: `FH-KL-${Math.floor(1100 + Math.random() * 800)}`,
    };

    set((s) => ({
      sales: [sale, ...s.sales],
      lastReceipt: sale,
      posItems: [],
      posDiscount: 0,
      posCustomerId: null,
      staffStatuses: {
        ...s.staffStatuses,
        [staff.id]: "available",
      },
      staff: s.staff.map((m) =>
        m.id === staff.id
          ? {
              ...m,
              status: "available",
              todaySales: m.todaySales + total,
              todayCommission: m.todayCommission + commission,
              todayCustomers: m.todayCustomers + 1,
              monthlySales: m.monthlySales + total,
              monthlyCommission: m.monthlyCommission + commission,
            }
          : m,
      ),
      queue: s.queue.map((q) =>
        q.customerId === state.posCustomerId &&
        (q.status === "awaiting-payment" || q.status === "in-service")
          ? { ...q, status: "completed" as const }
          : q,
      ),
    }));

    return sale;
  },

  setTrackingTicketId: (trackingTicketId) => set({ trackingTicketId }),
}));

export function getBranchJoinUrl(branchId: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://barberflow.app");
  return `${base}/join/${branchId}`;
}
