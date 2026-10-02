import type { Branch } from "@/lib/types";

/**
 * A branch a screen has been asked for but the store doesn't hold yet. The
 * branches arrive with the first shop snapshot, which itself is fetched for a
 * branch id — so a page reached by a link (`/join/<id>`, `/display?branch=`)
 * needs the id before it has the branch. Blank until the real one lands.
 */
export function placeholderBranch(id: string): Branch {
  return {
    id,
    tenantId: "",
    name: "",
    address: "",
    city: "",
    phone: "",
    status: "open",
    openHours: "",
    avgWaitMins: 0,
    queueCount: 0,
    chairs: 0,
  };
}
