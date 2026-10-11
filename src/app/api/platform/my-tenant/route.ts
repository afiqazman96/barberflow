import { getSession } from "@/lib/auth/session";
import { myTenantFor } from "@/lib/platform/queries";

/**
 * A signed-in staff member's own tenant and feature row — what the portal
 * shell uses to block a suspended shop and gate nav items by plan. Scoped by
 * the session's own `tenantId`; there is no way to ask for anyone else's.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await myTenantFor(session.staff.tenantId);
  if (!result) {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
