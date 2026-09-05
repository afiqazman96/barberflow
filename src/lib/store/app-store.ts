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
  DrawerSession,
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
  setPosDiscountMode: (mode: "amount" | "percent") => void;
  setPosDiscountReason: (reason: string) => void;
  setPosTip: (n: number) => void;
  setPosCustomerId: (id: string | null) => void;
  setPosMembershipPlan: (planId: string | null) => void;
  /** Load a queue ticket into the POS: customer, its barber, and its services. */
  loadPosTicket: (ticketId: string) => void;
  setPosStaffId: (id: string | null) => void;
  clearPos: () => void;
  completePayment: (method: PaymentMethod) => Sale;
  voidSale: (saleId: string, reason: string, by: string) => void;
  openDrawer: (input: {
    cashierId: string;
    cashierName: string;
    openingFloat: number;
  }) => void;
  addCashMovement: (input: {
    type: CashMovement["type"];
    amount: number;
    note: string;
    saleId?: string;
  }) => void;
  closeDrawer: (input: { countedAmount: number; closingNote?: string }) => void;
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
  posDiscountMode: "amount",
  posDiscountReason: "",
  posTip: 0,
  posCustomerId: null,
  posTicketId: null,
  posStaffId: null,
  posMembershipPlanId: null,
  drawerSession: null,
  drawerHistory: [],
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
  setPosDiscountMode: (posDiscountMode) => set({ posDiscountMode }),
  setPosDiscountReason: (posDiscountReason) => set({ posDiscountReason }),
  setPosTip: (posTip) => set({ posTip: Math.max(0, posTip) }),
  setPosCustomerId: (posCustomerId) => set({ posCustomerId }),
  setPosMembershipPlan: (posMembershipPlanId) => set({ posMembershipPlanId }),
  setPosStaffId: (posStaffId) => set({ posStaffId }),

  loadPosTicket: (ticketId) =>
    set((s) => {
      const ticket = s.queue.find((q) => q.id === ticketId);
      if (!ticket) return {};
      const cust = CUSTOMERS.find((c) => c.id === ticket.customerId);
      const items: PosItem[] =
        s.posItems.length > 0
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
      return {
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

  completePayment: (method) => {
    const state = get();

    const ticket = state.posTicketId
      ? state.queue.find((q) => q.id === state.posTicketId)
      : undefined;

    // The sale is credited to a barber — the one picked on the POS, else the
    // one the ticket was assigned to. Never the cashier ringing it up.
    const staff =
      state.staff.find((s) => s.id === state.posStaffId) ??
      state.staff.find(
        (s) => s.id === (ticket?.assignedStaffId ?? ticket?.preferredStaffId),
      ) ??
      state.staff.find((s) => s.role === "barber") ??
      STAFF[2];

    const crmCustomer = state.posCustomerId
      ? CUSTOMERS.find((c) => c.id === state.posCustomerId)
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

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const discount =
      state.posDiscountMode === "percent"
        ? Math.round(((subtotal * state.posDiscount) / 100) * 100) / 100
        : state.posDiscount;
    const goodsTotal = Math.max(0, subtotal - discount);
    const tip = state.posTip;
    const total = goodsTotal + tip;

    // Commission is on the goods, not the tip; the tip passes straight through.
    const commission = calcCommission(
      goodsTotal,
      staff.id,
      state.posItems,
      state.commissionRules,
    );

    const sale: Sale = {
      id: `sale-${Date.now()}`,
      branchId: state.branchId,
      customerId: state.posCustomerId ?? "walk-in",
      customerName,
      staffId: staff.id,
      staffName: staff.name,
      items,
      subtotal,
      discount,
      discountReason:
        discount > 0 && state.posDiscountReason.trim()
          ? state.posDiscountReason.trim()
          : undefined,
      voucher: 0,
      tip,
      total,
      paymentMethod: method,
      commission,
      createdAt: new Date().toISOString(),
      receiptNo: `FH-KL-${Math.floor(1100 + Math.random() * 800)}`,
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
            }
          : null;

      return {
        sales: [sale, ...s.sales],
        lastReceipt: sale,
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
        staffStatuses: {
          ...s.staffStatuses,
          [staff.id]: "available",
        },
        staff: s.staff.map((m) =>
          m.id === staff.id
            ? {
                ...m,
                status: "available",
                todaySales: m.todaySales + goodsTotal,
                todayCommission: m.todayCommission + barberTake,
                todayCustomers: m.todayCustomers + 1,
                monthlySales: m.monthlySales + goodsTotal,
                monthlyCommission: m.monthlyCommission + barberTake,
              }
            : m,
        ),
        queue: s.queue.map((q) =>
          q.id === state.posTicketId &&
          (q.status === "awaiting-payment" || q.status === "in-service")
            ? { ...q, status: "completed" as const }
            : q,
        ),
      };
    });

    return sale;
  },

  voidSale: (saleId, reason, by) =>
    set((s) => {
      const sale = s.sales.find((x) => x.id === saleId);
      if (!sale || sale.voided) return {};
      const at = new Date().toISOString();
      const goodsTotal = sale.total - sale.tip;
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
            }
          : null;

      const restock = new Map(
        sale.items
          .filter((i) => i.type === "product")
          .map((i) => [i.name, i.quantity] as const),
      );

      return {
        sales: s.sales.map((x) =>
          x.id === saleId ? { ...x, voided: { reason, at, by } } : x,
        ),
        staff: s.staff.map((m) =>
          m.id === sale.staffId
            ? {
                ...m,
                todaySales: Math.max(0, m.todaySales - goodsTotal),
                todayCommission: Math.max(0, m.todayCommission - barberTake),
                todayCustomers: Math.max(0, m.todayCustomers - 1),
                monthlySales: Math.max(0, m.monthlySales - goodsTotal),
                monthlyCommission: Math.max(0, m.monthlyCommission - barberTake),
              }
            : m,
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

  openDrawer: ({ cashierId, cashierName, openingFloat }) =>
    set((s) => {
      if (s.drawerSession) return {};
      return {
        drawerSession: {
          id: `drw-${Date.now()}`,
          branchId: s.branchId,
          cashierId,
          cashierName,
          openedAt: new Date().toISOString(),
          openingFloat: Math.max(0, openingFloat),
          movements: [],
        },
      };
    }),

  addCashMovement: ({ type, amount, note, saleId }) =>
    set((s) => {
      if (!s.drawerSession) return {};
      const signed =
        type === "pay-out" || type === "refund"
          ? -Math.abs(amount)
          : Math.abs(amount);
      return {
        drawerSession: {
          ...s.drawerSession,
          movements: [
            ...s.drawerSession.movements,
            {
              id: `cm-${Date.now()}`,
              type,
              amount: signed,
              note,
              at: new Date().toISOString(),
              saleId,
            },
          ],
        },
      };
    }),

  closeDrawer: ({ countedAmount, closingNote }) =>
    set((s) => {
      if (!s.drawerSession) return {};
      const closed: DrawerSession = {
        ...s.drawerSession,
        closedAt: new Date().toISOString(),
        countedAmount: Math.max(0, countedAmount),
        closingNote: closingNote?.trim() || undefined,
      };
      return {
        drawerSession: null,
        drawerHistory: [closed, ...s.drawerHistory],
      };
    }),

  setTrackingTicketId: (trackingTicketId) => set({ trackingTicketId }),
}));

/** Cash the drawer should hold right now: opening float plus every movement. */
export function drawerExpected(session: DrawerSession): number {
  return (
    session.openingFloat +
    session.movements.reduce((sum, m) => sum + m.amount, 0)
  );
}

export function getBranchJoinUrl(branchId: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://barberflow.app");
  return `${base}/join/${branchId}`;
}
