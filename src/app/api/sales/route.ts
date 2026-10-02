import { getSession } from "@/lib/auth/session";
import { staffSalesSnapshot } from "@/lib/sales/queries";

/**
 * Recent sales for the signed-in staff member — a barber gets only their own.
 * A Route Handler for the same reason as `/api/queue`.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await staffSalesSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
