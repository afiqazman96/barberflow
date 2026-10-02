import type { CommissionRule, PosItem } from "@/lib/types";

/**
 * Shared by the POS (a live preview) and the server (the figure that is
 * stored), so the number a cashier sees is the number the barber is paid.
 */

/**
 * Commission on a sale. `total` is the goods figure after any discount.
 *
 * - A staff-specific Percentage or Fixed rule scoped to "all" replaces the
 *   barber's rate entirely (an override).
 * - Otherwise each item earns a base rate — the most specific matching
 *   percentage rule wins (one for that exact service/product, then the
 *   service/product default, then a rule for everything). No matching rule
 *   means no base commission; there is no hidden default.
 * - A staff-specific Service/Product percentage rule adds on top as a bonus.
 * - Fixed rules add a flat amount for each eligible item sold.
 * - A discount lowers what every line earns commission on, pro rata.
 */
export function calcCommission(
  total: number,
  staffId: string,
  items: PosItem[],
  rules: CommissionRule[],
): number {
  const active = rules.filter((r) => r.active);
  const staffOverride = active.find(
    (r) =>
      r.staffId === staffId &&
      r.appliesTo === "all" &&
      (r.type === "percentage" || r.type === "fixed"),
  );
  if (staffOverride) {
    return staffOverride.type === "percentage"
      ? Math.round(total * (staffOverride.value / 100) * 100) / 100
      : Math.round(staffOverride.value * 100) / 100;
  }

  const isPercent = (r: CommissionRule) =>
    r.type === "percentage" || r.type === "service-based" || r.type === "product-based";
  const specificity = (r: CommissionRule) =>
    r.serviceId || r.productId ? 2 : r.appliesTo === "all" ? 0 : 1;

  const gross = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const ratio = gross > 0 ? Math.min(1, Math.max(0, total) / gross) : 1;

  let commission = 0;
  for (const item of items) {
    const line = item.unitPrice * item.quantity * ratio;
    const matching = active.filter((r) => {
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

    const base = matching
      .filter((r) => isPercent(r) && !(r.staffId && r.appliesTo !== "all"))
      .sort((a, b) => specificity(b) - specificity(a))[0];
    const bonus = matching
      .filter((r) => isPercent(r) && r.staffId && r.appliesTo !== "all")
      .reduce((sum, r) => sum + r.value, 0);
    const fixed = matching
      .filter((r) => r.type === "fixed")
      .reduce((sum, r) => sum + r.value * item.quantity, 0);

    commission += line * (((base?.value ?? 0) + bonus) / 100) + fixed;
  }

  return Math.round(commission * 100) / 100;
}
