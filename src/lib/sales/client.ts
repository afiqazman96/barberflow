import type { SalesSnapshot } from "./dto";

/**
 * The browser's side of sales. Like the queue's client it does not import the
 * store — the store imports this.
 */

/** Null when the snapshot could not be read; the caller keeps what it has. */
export async function fetchSalesSnapshot(): Promise<SalesSnapshot | null> {
  try {
    const response = await fetch("/api/sales", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as SalesSnapshot;
  } catch {
    return null;
  }
}
