import type { TaxConfig } from "@/lib/types";

/** Sensible starting point: everything off, real Malaysian rates pre-filled. */
export const DEFAULT_TAX_CONFIG: TaxConfig = {
  serviceChargeEnabled: false,
  serviceChargeRate: 10,
  sstEnabled: false,
  sstRate: 8,
  sstRegNo: "",
  applyTo: "services",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ChargeBreakdown {
  /** All line items before discount. */
  subtotal: number;
  discount: number;
  /** Goods after discount — the base for commission and reporting. */
  goodsTotal: number;
  serviceCharge: number;
  serviceChargeRate: number;
  tax: number;
  taxRate: number;
  tip: number;
  /** What the customer pays: goods + service charge + SST + tip. */
  total: number;
}

/**
 * The single source of truth for POS money math, shared by the cashier POS,
 * the payment screen, the owner POS and the store's `completePayment`.
 *
 * Service charge and SST are levied on the service portion of the bill —
 * retail products already carry sales tax at import/manufacture, so the
 * Malaysian norm is not to re-charge them here — unless the owner sets
 * `applyTo: "all"`. SST is charged on the service charge too. A bill-wide
 * discount is taken off the taxable base in full (even when it is larger
 * than the service portion) so tax is never charged on a discounted amount.
 */
export function computeCharges(opts: {
  serviceSubtotal: number;
  otherSubtotal: number;
  discount: number;
  tip?: number;
  config: TaxConfig;
}): ChargeBreakdown {
  const { config } = opts;
  const subtotal = round2(opts.serviceSubtotal + opts.otherSubtotal);
  const discount = round2(Math.min(Math.max(0, opts.discount), subtotal));
  const goodsTotal = round2(Math.max(0, subtotal - discount));
  const tip = round2(Math.max(0, opts.tip ?? 0));

  const base =
    config.applyTo === "all"
      ? goodsTotal
      : round2(Math.max(0, opts.serviceSubtotal - discount));

  const serviceCharge = config.serviceChargeEnabled
    ? round2((base * config.serviceChargeRate) / 100)
    : 0;
  const tax = config.sstEnabled
    ? round2(((base + serviceCharge) * config.sstRate) / 100)
    : 0;

  return {
    subtotal,
    discount,
    goodsTotal,
    serviceCharge,
    serviceChargeRate: serviceCharge > 0 ? config.serviceChargeRate : 0,
    tax,
    taxRate: tax > 0 ? config.sstRate : 0,
    tip,
    total: round2(goodsTotal + serviceCharge + tax + tip),
  };
}
