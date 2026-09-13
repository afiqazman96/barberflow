import { redirect } from "next/navigation";

/** Cash Drawer moved under the POS section as a tab. */
export default function CashierDrawerRedirect() {
  redirect("/cashier/pos/drawer");
}
