"use client";

import { toast } from "sonner";

import { useAppStore } from "@/lib/store/app-store";
import type { Sale } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

import { emailReceipt } from "./actions";
import type { ReceiptEmailInput } from "./types";

const PAYMENT_LABELS = { cash: "Cash", card: "Card", qr: "QR Pay" } as const;

export function receiptEmailInput(sale: Sale, to: string, auto: boolean): ReceiptEmailInput {
  const profile = useAppStore.getState().businessProfile;
  return {
    to,
    shopName: profile.name,
    address: profile.address,
    phone: profile.phone,
    receiptNo: sale.receiptNo,
    dateLabel: formatDateTime(sale.createdAt),
    customerName: sale.customerName,
    barberName: sale.staffName || undefined,
    items: sale.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    discountReason: sale.discountReason,
    serviceCharge: sale.serviceCharge,
    serviceChargeRate: sale.serviceChargeRate,
    tax: sale.tax,
    taxRate: sale.taxRate,
    tip: sale.tip,
    total: sale.total,
    paymentLabel: PAYMENT_LABELS[sale.paymentMethod] ?? "Other",
    cardLast4: sale.card?.last4,
    auto,
  };
}

/**
 * Emails a receipt and tells the user how it went. Never throws — a failed
 * email must not get in the way of a sale.
 *
 * `auto` is the send that happens at checkout: it stays quiet when email isn't
 * set up (that is a setup matter, not something to nag a cashier about on every
 * sale) and asks for a retry if it fails for any other reason.
 */
export async function sendReceiptEmail(
  sale: Sale,
  to: string,
  opts: { auto?: boolean } = {},
): Promise<boolean> {
  const auto = !!opts.auto;
  try {
    const result = await emailReceipt(receiptEmailInput(sale, to, auto));
    if (result.ok) {
      toast.success(result.dryRun ? "Receipt emailed (test mode)" : "Receipt emailed", {
        description: `${sale.receiptNo} → ${to}`,
      });
      return true;
    }
    if (result.notConfigured) {
      if (!auto) {
        toast.error("Email isn't set up yet", {
          description: "Ask the owner to connect the email service, or hand the customer a copy.",
        });
      }
      return false;
    }
    toast.error("Couldn't email the receipt", {
      description: auto ? `${result.error} — use Email receipt to try again` : result.error,
    });
    return false;
  } catch {
    toast.error("Couldn't email the receipt", {
      description: "Check the connection and try again",
    });
    return false;
  }
}
