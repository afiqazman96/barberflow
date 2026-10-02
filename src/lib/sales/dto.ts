import type { DrawerSession, PaymentMethod, Sale } from "@/lib/types";

/**
 * What crosses to the browser about sales. Outside the server modules so
 * Client Components can import the types.
 */

/** Sent on each branch's queue topic by `20261004000000_sales_ledger`. */
export const SALES_CHANGED_EVENT = "sale_changed";

/** Sent by `20261005000000_cash_drawer` when a branch's till changes. */
export const DRAWER_CHANGED_EVENT = "drawer_changed";

export type SalesSnapshot = {
  sales: Sale[];
  /** Every branch this snapshot speaks for. */
  branchIds: string[];
  /**
   * Set when the snapshot holds only the caller's own sales (a barber), so the
   * store leaves everyone else's alone.
   */
  onlyStaffId?: string;
  /**
   * The tills at those branches, for the owner and the counter (never a
   * barber). A cashier's copy is blind: see `forCashier` in `drawer.ts`.
   */
  drawers?: { open: DrawerSession[]; history: DrawerSession[] };
};

/**
 * How a close went. A count outside tolerance is bounced once for a recount,
 * then needs a written reason and goes to the owner for review.
 */
export type CloseDrawerResult =
  | "closed"
  | "needs-review"
  | "recount"
  | "reason-required"
  | "blocked"
  | "forbidden";

/**
 * What the POS sends to take payment: what is on the bill and how it is paid.
 * Never the money — prices, charges, totals and commission are all worked out
 * again on the server from the catalogue and the shop's own settings.
 */
export type CheckoutInput = {
  branchId: string;
  ticketId?: string | null;
  customerId?: string | null;
  /** Shown on the receipt when there is no ticket or customer row to name them. */
  customerName?: string;
  customerEmail?: string;
  staffId?: string | null;
  items: {
    id: string;
    type: "service" | "product";
    quantity: number;
    /** Checked against the catalogue: the price, or a service's member price. */
    unitPrice: number;
  }[];
  membershipPlanId?: string | null;
  discount: { mode: "amount" | "percent"; value: number; reason?: string };
  tip: number;
  method: PaymentMethod;
  card?: { scheme?: string; last4?: string; approvalCode?: string };
  /** One per bill: a retry after a dropped connection must not charge twice. */
  idempotencyKey: string;
};

export type CheckoutResult =
  | { ok: true; sale: Sale }
  | { ok: false; error: string };
