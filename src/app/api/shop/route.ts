import { getSession } from "@/lib/auth/session";
import { staffShopSnapshot } from "@/lib/shop/queries";

/**
 * The shop's rules, roster, leave, recent shifts and chairs for the signed-in
 * staff member. A Route Handler for the same reason as `/api/queue`.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await staffShopSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
