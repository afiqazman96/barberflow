import type {
  Branch,
  BusinessProfile,
  Chair,
  CommissionRule,
  Customer,
  LeaveEntry,
  MembershipPlan,
  Product,
  Service,
  OpsRules,
  RosterDay,
  ShiftRecord,
  StaffMember,
  TaxConfig,
} from "@/lib/types";

/**
 * What crosses to the browser about how the shop runs: its rules, who is
 * rostered when, who is away, who has clocked in, and who sits where.
 * Outside the server modules so Client Components can import the types.
 */

/**
 * Sent on each branch's queue topic (`queueTopic`) by the triggers in
 * `20261003000000_shifts_roster_ops`.
 */
export const SHOP_CHANGED_EVENT = "shop_changed";

export type ShopSnapshot = {
  opsRules: OpsRules;
  /** Weekly roster per staff id; index 0 = Sunday. Absent = no roster set. */
  roster: Record<string, RosterDay[]>;
  leaves: LeaveEntry[];
  /** Staff snapshots only; the public one carries none. */
  shifts: ShiftRecord[];
  /** The chair each staff member at the covered branches sits at. */
  staffChairs: Record<string, string | null>;
  /** Every branch this snapshot speaks for. */
  branchIds: string[];
  /**
   * Staff snapshots only: the service charge and SST, and the commission
   * rules — what the POS previews a bill with, and the server charges it by.
   */
  taxConfig?: TaxConfig;
  commissionRules?: CommissionRule[];
  /** What the shop sells; public snapshots carry the services too. */
  services: Service[];
  /** Staff snapshots only. */
  products?: Product[];
  /** Public snapshots carry them too, for the customer's profile screen. */
  membershipPlans?: MembershipPlan[];
  /**
   * The owner's and the counter's only — never a barber's, never a
   * customer's: phone numbers and emails stay with the people who serve.
   */
  customers?: Customer[];
  /**
   * Who works here. The owner gets the whole team with contact details; the
   * counter and barbers their branch without; a customer the barbers only.
   * Sales figures on each member are zero here — `hydrateSales` fills them.
   */
  team: StaffMember[];
  /** Every branch in the shop, with today's line at each. */
  branches: Branch[];
  /** The chairs at the branches this snapshot speaks for. */
  chairs: Chair[];
  businessProfile: BusinessProfile;
};

export type RosterDayInput = Pick<RosterDay, "off" | "start" | "end">;
