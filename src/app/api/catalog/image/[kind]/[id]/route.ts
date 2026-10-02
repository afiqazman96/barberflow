import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * A service's or product's uploaded picture, or the shop's logo (`logo/<tenant
 * id>`), decoded from the data URL it is stored as. Public — the same pictures
 * the booking form and receipts show anyone — and cached for good: the
 * snapshots link here with a `?v=` version, so a new upload is a new URL.
 */

const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/;

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/catalog/image/[kind]/[id]">,
) {
  const { kind, id } = await ctx.params;
  const row =
    kind === "service"
      ? await prisma.service.findUnique({ where: { id }, select: { imageUrl: true } })
      : kind === "product"
        ? await prisma.product.findUnique({ where: { id }, select: { imageUrl: true } })
        : kind === "logo"
          ? await prisma.tenantSettings
              .findUnique({ where: { tenantId: id }, select: { logoUrl: true } })
              .then((s) => (s ? { imageUrl: s.logoUrl } : null))
          : null;

  const match = row?.imageUrl?.match(DATA_URL);
  if (!match) return new Response(null, { status: 404 });

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable",
      // Only ever an image: never let the browser sniff it into anything else.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
