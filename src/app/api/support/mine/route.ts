import { getSession } from "@/lib/auth/session";
import { myTicketsFor } from "@/lib/platform/queries";

/**
 * A signed-in shop session's own support tickets — status-only visibility,
 * no reply thread. Kept out of `/api/platform` since that route is
 * explicitly the platform-session snapshot.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickets = await myTicketsFor();
  return Response.json({ tickets }, { headers: { "Cache-Control": "no-store" } });
}
