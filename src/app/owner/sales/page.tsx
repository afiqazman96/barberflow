import { redirect } from "next/navigation";

/** Sales & Receipts moved under the POS section as a tab. */
export default function OwnerSalesRedirect() {
  redirect("/owner/pos/receipts");
}
