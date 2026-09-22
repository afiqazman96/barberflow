import { listBranchDetails } from "@/lib/branches/queries";
import { listStaffDirectory } from "@/lib/staff/queries";

import { OwnerSettingsScreen } from "./settings-screen";

/**
 * Owner Settings. Branches, their chairs and the team behind the chair
 * assignments are read from the database for the signed-in owner's tenant;
 * the rest of the screen (services, tax, queue rules, membership) still comes
 * from the client store until those move to the backend.
 *
 * The queries run in parallel — neither depends on the other, and both resolve
 * the session through the same cached guard, so this is one session lookup.
 */
export default async function OwnerSettingsPage() {
  const [{ branches, chairs }, directory] = await Promise.all([
    listBranchDetails(),
    listStaffDirectory(),
  ]);

  return (
    <OwnerSettingsScreen
      branches={branches}
      chairs={chairs}
      directory={directory}
    />
  );
}
