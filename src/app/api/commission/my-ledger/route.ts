import { getSession } from "@/lib/auth/session";
import { commissionLedgerForStaff } from "@/lib/shop/queries";

/**
 * The signed-in staff member's own lifetime earned vs. paid commission —
 * the same numbers the owner's ledger shows for them, so a payout the owner
 * records is actually visible here instead of only on the owner's screen.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ledger = await commissionLedgerForStaff(session.staff.tenantId, session.staff.id);
  return Response.json(ledger, { headers: { "Cache-Control": "no-store" } });
}
