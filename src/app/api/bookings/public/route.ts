import type { NextRequest } from "next/server";

import { publicBookingsSnapshot } from "@/lib/bookings/queries";

/**
 * The taken slots at one branch — `?branch=<id>` — for the customer booking
 * form, plus the caller's own booking. No session: other people's bookings
 * are reduced to their slot in `publicBookingsSnapshot`.
 */
export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get("branch");

  return Response.json(await publicBookingsSnapshot(branchId), {
    headers: { "Cache-Control": "no-store" },
  });
}
