import { getSession } from "@/lib/auth/session";
import { commissionLedgerFor } from "@/lib/shop/queries";

/** Every barber's lifetime earned vs. paid commission. Owner only. */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop" || session.staff.role !== "OWNER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ledger = await commissionLedgerFor(session.staff.tenantId);
  return Response.json(ledger, { headers: { "Cache-Control": "no-store" } });
}
