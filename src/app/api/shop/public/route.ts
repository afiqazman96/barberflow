import type { NextRequest } from "next/server";

import { publicShopSnapshot } from "@/lib/shop/queries";

/**
 * One branch's rules, roster and days away — `?branch=<id>` — so the
 * customer booking form offers only real slots. No session; no shifts and no
 * leave reasons (see `publicShopSnapshot`).
 */
export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get("branch");
  const snapshot = await publicShopSnapshot(branchId);
  if (!snapshot) {
    return Response.json({ error: "Branch not found" }, { status: 404 });
  }

  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
