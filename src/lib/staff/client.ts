import { toast } from "sonner";

import { requestQueueRefetch } from "@/lib/queue/client";
import type { StaffStatus } from "@/lib/types";

import { setMyStatus } from "./actions";

/**
 * Persist a status the signed-in staff member just gave themselves, which the
 * store has already applied locally. The database trigger then pokes every
 * screen at the branch. If the server refuses, re-read the snapshot so this
 * device goes back to what everyone else sees.
 */
export function pushOwnStatus(status: StaffStatus): void {
  // Derived from the ticket in service on every screen; never stored.
  if (status === "busy") return;

  const failed = (description?: string) => {
    toast.error("Couldn't update your status", { description });
    requestQueueRefetch();
  };

  setMyStatus(status).then(
    (result) => {
      if (!result.ok) failed(result.error);
    },
    () => failed("Check your connection and try again"),
  );
}
