import type { NextRequest } from "next/server";

import { publicQueueSnapshot } from "@/lib/queue/queries";

/**
 * One branch's queue as the lobby may see it — `?branch=<id>` — for the TV
 * display and for customers tracking their place. No session: what it returns
 * is masked in `publicQueueSnapshot`, apart from the caller's own ticket.
 */
export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get("branch");

  return Response.json(await publicQueueSnapshot(branchId), {
    headers: { "Cache-Control": "no-store" },
  });
}
