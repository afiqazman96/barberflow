import { getSession } from "@/lib/auth/session";
import { notificationsFor } from "@/lib/notifications/queries";

/** The signed-in shop session's own notifications — the bell's poll target. */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await notificationsFor();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
