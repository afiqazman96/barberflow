"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Ask = {
  title: string;
  description?: string;
  confirmLabel?: string;
  run: () => void;
};

/**
 * Put a "are you sure?" step in front of a handler: call `ask({...})` instead
 * of doing the thing, and render `node` once anywhere in the component.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Ask | null>(null);

  const node = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      onConfirm={() => pending?.run()}
    />
  );

  return { ask: setPending, node };
}
