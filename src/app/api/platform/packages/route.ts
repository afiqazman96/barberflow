import { packagesFor } from "@/lib/platform/queries";

/**
 * Plans and their feature matrix — what /pricing shows a visitor. Public on
 * purpose: unlike `/api/platform`, nothing here is tenant-specific or
 * sensitive.
 */
export async function GET() {
  const { packages, featureMatrix } = await packagesFor();
  return Response.json(
    { packages, featureMatrix },
    { headers: { "Cache-Control": "no-store" } },
  );
}
