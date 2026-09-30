import { getSession } from "@/lib/auth/session";
import { staffQueueSnapshot } from "@/lib/queue/queries";

/**
 * Today's queue for the signed-in staff member's shop.
 *
 * A Route Handler rather than a Server Action because this is a read that
 * every open screen repeats whenever Realtime pokes it: actions are dispatched
 * one at a time per client, so a refetch would queue behind — and hold up —
 * the very mutation that caused it.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await staffQueueSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
