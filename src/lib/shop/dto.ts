import type {
  CommissionRule,
  LeaveEntry,
  OpsRules,
  RosterDay,
  ShiftRecord,
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
};

export type RosterDayInput = Pick<RosterDay, "off" | "start" | "end">;
