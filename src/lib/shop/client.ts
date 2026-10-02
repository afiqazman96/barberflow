import { toast } from "sonner";

import type { ActionResult } from "@/lib/auth/types";
import type { QueueScope } from "@/lib/queue/client";
import { requestQueueRefetch } from "@/lib/queue/client";
import type { CommissionRule, OpsRules, TaxConfig } from "@/lib/types";

import {
  clockIn,
  clockOut,
  createCommissionRule,
  deleteLeave,
  ownerClockIn,
  ownerClockOut,
  saveLeave,
  saveOpsRules,
  saveRosterDay,
  saveTaxConfig,
  setCommissionRuleActive,
} from "./actions";
import type { RosterDayInput, ShopSnapshot } from "./dto";

/**
 * The browser's side of shifts, roster, leave and rules. Like the queue's
 * client it does not import the store — the store imports this, applies a
 * change locally, then persists it here.
 */

/** Null when the snapshot could not be read; the caller keeps what it has. */
export async function fetchShopSnapshot(
  scope: QueueScope,
): Promise<ShopSnapshot | null> {
  const url =
    scope.kind === "staff"
      ? "/api/shop"
      : `/api/shop/public?branch=${encodeURIComponent(scope.branchId)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ShopSnapshot | null;
  } catch {
    return null;
  }
}

/**
 * Run a write the store has already applied. On refusal, say why and re-read
 * everything, which replaces the optimistic change with the truth.
 */
function persist(title: string, write: () => Promise<ActionResult>): void {
  const failed = (description?: string) => {
    toast.error(title, { description });
    requestQueueRefetch();
  };
  write().then(
    (result) => {
      if (!result.ok) failed(result.error);
    },
    () => failed("Check your connection and try again"),
  );
}

export function pushClockIn(
  staffId: string,
  opts: { self: boolean; chairId?: string | null; note?: string },
): void {
  persist("Couldn't start the shift", () =>
    opts.self
      ? clockIn(opts.chairId)
      : ownerClockIn(staffId, { chairId: opts.chairId, note: opts.note }),
  );
}

export function pushClockOut(
  staffId: string,
  opts: { self: boolean; note?: string },
): void {
  persist("Couldn't end the shift", () =>
    opts.self ? clockOut() : ownerClockOut(staffId, opts.note),
  );
}

export function pushRosterDay(staffId: string, weekday: number, day: RosterDayInput): void {
  persist("Couldn't save the roster", () => saveRosterDay(staffId, weekday, day));
}

export function pushLeave(input: { staffId: string; date: string; reason: string }): void {
  persist("Couldn't save the leave", () => saveLeave(input));
}

export function pushRemoveLeave(staffId: string, date: string): void {
  persist("Couldn't remove the leave", () => deleteLeave(staffId, date));
}

export function pushOpsRules(rules: OpsRules): void {
  persist("Couldn't save the rules", () => saveOpsRules(rules));
}

export function pushTaxConfig(config: TaxConfig): void {
  persist("Couldn't save tax & charges", () => saveTaxConfig(config));
}

/**
 * The rule shows straight away under a temporary id; the refetch its write
 * triggers swaps in the stored one.
 */
export function pushNewCommissionRule(rule: Omit<CommissionRule, "id">): void {
  persist("Couldn't add the rule", () => createCommissionRule(rule));
}

export function pushCommissionRuleActive(id: string, active: boolean): void {
  persist("Couldn't update the rule", () => setCommissionRuleActive(id, active));
}
