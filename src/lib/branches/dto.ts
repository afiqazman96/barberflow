import type { Branch } from "@/lib/types";

/**
 * A branch as the Settings editor needs it.
 *
 * Nullable columns are flattened to "" because every field behind them is a
 * text input, and a controlled input cannot hold null. The trip back through
 * the action turns "" into null again, so a cleared box is stored as "not
 * recorded" rather than an empty string.
 *
 * `chairs` is counted from the chair rows rather than stored: the store keeps
 * it as a number on the branch, but in the database chairs are rows, and a
 * count that can disagree with them is a bug waiting to happen.
 *
 * Live queue state (`queueCount`, `avgWaitMins`) is deliberately absent — that
 * belongs to the store, not to a settings read.
 */
export type BranchDetail = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  openHours: string;
  status: Branch["status"];
  chairs: number;
};

/** One chair, plus whoever is sitting at it (`Staff.chairId` is the unique side). */
export type ChairDetail = {
  id: string;
  branchId: string;
  number: number;
  label: string;
  staffId: string | null;
};
