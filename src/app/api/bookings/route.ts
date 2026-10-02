import { getSession } from "@/lib/auth/session";
import { staffBookingsSnapshot } from "@/lib/bookings/queries";

/**
 * Appointments for the signed-in staff member's shop. A Route Handler rather
 * than a Server Action for the same reason as `/api/queue`: it is re-read on
 * every Realtime poke, and must not queue behind the mutation that caused it.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "shop") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await staffBookingsSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
