/** Variance (RM) a close can be off by before the count is challenged. */
export const DRAWER_VARIANCE_TOLERANCE = 5;
/** Largest single pay-out (RM) a cashier can make; bigger ones go through the owner. */
export const CASHIER_PAYOUT_LIMIT = 200;
/** Shortest reason accepted when a count is still off after a recount. */
export const MIN_VARIANCE_REASON = 10;

export const NOTE_DENOMINATIONS = [
  { key: "100", label: "RM100", value: 100 },
  { key: "50", label: "RM50", value: 50 },
  { key: "20", label: "RM20", value: 20 },
  { key: "10", label: "RM10", value: 10 },
  { key: "5", label: "RM5", value: 5 },
  { key: "1", label: "RM1", value: 1 },
] as const;

/** Key holding loose coins as a plain RM amount rather than a count. */
export const COINS_KEY = "coins";

export const PAYOUT_CATEGORIES = [
  "Bank drop",
  "Supplies",
  "Tip payout",
  "Change for float",
  "Other",
] as const;

export const PAYIN_CATEGORIES = ["Change top-up", "Owner top-up", "Other"] as const;

export function denominationTotal(d: Record<string, number>): number {
  const notes = NOTE_DENOMINATIONS.reduce(
    (sum, n) => sum + (Number(d[n.key]) || 0) * n.value,
    0,
  );
  return Math.round((notes + (Number(d[COINS_KEY]) || 0)) * 100) / 100;
}
