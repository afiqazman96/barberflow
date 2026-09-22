import { listBranchOptions, listStaffDirectory } from "@/lib/staff/queries";

import { OwnerStaffScreen } from "./staff-screen";

/**
 * Staff Management. The team, the branches they can be posted to and the
 * chairs they can be seated at all come from the database for the signed-in
 * owner's tenant; the live shop state around them (statuses, sales figures)
 * still comes from the client store until that moves to the backend.
 *
 * The queries are awaited here rather than in the screen so the first paint
 * already has the real team — `owner/loading.tsx` covers the wait. They run
 * in parallel because neither depends on the other; both resolve the session
 * through the same cached guard, so this is still one session lookup.
 */
export default async function OwnerStaffPage() {
  const [directory, { branches, chairs }] = await Promise.all([
    listStaffDirectory(),
    listBranchOptions(),
  ]);

  return (
    <OwnerStaffScreen
      directory={directory}
      branches={branches}
      chairs={chairs}
    />
  );
}
