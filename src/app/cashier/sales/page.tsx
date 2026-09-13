import { redirect } from "next/navigation";

/** Sales & Receipts moved under the POS section as a tab. */
export default function CashierSalesRedirect() {
  redirect("/cashier/pos/receipts");
}
