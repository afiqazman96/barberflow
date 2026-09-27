/**
 * Shapes shared by the email server actions and the screens that call them.
 * Kept apart from `actions.ts`: a `"use server"` module may only export async
 * functions, so anything else there would become a callable endpoint.
 */

export type EmailResult =
  | { ok: true; /** Test mode: logged on the server, nothing was sent. */ dryRun?: boolean }
  | {
      ok: false;
      error: string;
      /** No API key / sender configured — the caller can fall back to copy-paste. */
      notConfigured?: boolean;
    };

export interface ReceiptEmailItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptEmailInput {
  to: string;
  shopName: string;
  address?: string;
  phone?: string;
  receiptNo: string;
  dateLabel: string;
  customerName: string;
  barberName?: string;
  items: ReceiptEmailItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  serviceCharge?: number;
  serviceChargeRate?: number;
  tax?: number;
  taxRate?: number;
  tip: number;
  total: number;
  paymentLabel: string;
  cardLast4?: string;
  /** Sent automatically at checkout: repeat calls for the same sale are ignored. */
  auto?: boolean;
}

export interface TenantWelcomeInput {
  ownerName: string;
  ownerEmail: string;
  businessName: string;
  plan: string;
  /** Formatted for display, e.g. "10 Oct 2026". */
  trialEndsAt?: string;
  tempPassword: string;
}

export interface StaffWelcomeInput {
  staffId: string;
  tempPassword: string;
  mustChangePassword: boolean;
}
