import { getSession } from "@/lib/auth/session";
import { invoicesFor } from "@/lib/billing/queries";
import { packagesFor, supportTicketsFor, tenantsFor } from "@/lib/platform/queries";

/**
 * The Super Admin console's whole picture: every tenant, package and support
 * ticket. No Realtime here — one admin's edit refetches its own screen, and
 * another admin's tab catching up a few seconds later costs nothing.
 */
export async function GET() {
  const session = await getSession();
  if (session?.kind !== "platform") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [tenants, { packages, featureMatrix }, supportTickets, invoices] = await Promise.all([
    tenantsFor(),
    packagesFor(),
    supportTicketsFor(),
    invoicesFor(),
  ]);

  return Response.json(
    { tenants, packages, featureMatrix, supportTickets, invoices },
    { headers: { "Cache-Control": "no-store" } },
  );
}
