"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { endSupportSession } from "@/lib/support/actions";
import { usePlatformStore } from "@/lib/store/platform-store";
import { formatRelative } from "@/lib/utils";

/** Shown across every shop portal while a platform admin is "viewing as" a
 * tenant's owner. Never rendered for a real owner's own session. */
export function ImpersonationBanner({
  platformAdminName,
  startedAt,
}: {
  platformAdminName: string;
  startedAt: string;
}) {
  const tenantName = usePlatformStore((s) => s.myTenant?.name);

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-2 bg-[var(--warning)] px-4 py-2 text-center text-sm font-medium text-[#1c1917]">
      <Eye className="h-4 w-4 shrink-0" />
      <span>
        Viewing <strong>{tenantName ?? "this tenant"}</strong> as support — {platformAdminName},
        since {formatRelative(startedAt)}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 border-[#1c1917]/30 bg-transparent px-2.5 text-[#1c1917] hover:bg-[#1c1917]/10"
        onClick={() => void endSupportSession()}
      >
        Exit
      </Button>
    </div>
  );
}
