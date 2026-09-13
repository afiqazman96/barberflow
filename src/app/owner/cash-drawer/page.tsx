import { redirect } from "next/navigation";

/** Cash Drawer moved under the POS section as a tab. */
export default function OwnerCashDrawerRedirect() {
  redirect("/owner/pos/drawer");
}
