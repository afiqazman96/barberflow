import { toast } from "sonner";

import type { QueueTicket } from "@/lib/types";

import { updateTicket } from "./actions";
import type { QueueSnapshot } from "./dto";

/**
 * The browser's side of the queue: fetch a snapshot, push a change.
 *
 * Deliberately does not import the store — the store imports this, so its
 * mutators can persist what they just did optimistically.
 */

export type QueueScope =
  | { kind: "staff" }
  | { kind: "public"; branchId: string };

/** Null when the snapshot could not be read; the caller keeps what it has. */
export async function fetchQueueSnapshot(
  scope: QueueScope,
): Promise<QueueSnapshot | null> {
  const url =
    scope.kind === "staff"
      ? "/api/queue"
      : `/api/queue/public?branch=${encodeURIComponent(scope.branchId)}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as QueueSnapshot;
  } catch {
    return null;
  }
}

/**
 * Whoever is keeping the queue in sync on this page (`useQueueSync`) registers
 * its refetch here, so code that is not a component — the store — can ask for
 * the truth back after a write is refused.
 */
let refetch: (() => void) | null = null;

export function registerQueueRefetch(fn: () => void): () => void {
  refetch = fn;
  return () => {
    if (refetch === fn) refetch = null;
  };
}

export function requestQueueRefetch(): void {
  refetch?.();
}

/**
 * Persist a change the store has already applied locally. If the server
 * refuses — somebody else got to the ticket first — say so and re-read the
 * queue, which replaces the optimistic state with what actually happened.
 */
export function pushTicketPatch(id: string, patch: Partial<QueueTicket>): void {
  if (!patch.status) return;

  const failed = (description?: string) => {
    toast.error("Couldn't update the queue", { description });
    requestQueueRefetch();
  };

  updateTicket(id, {
    status: patch.status,
    assignedStaffId: patch.assignedStaffId,
    chairId: patch.chairId,
  }).then(
    (result) => {
      if (!result.ok) failed(result.error);
    },
    () => failed("Check your connection and try again"),
  );
}
