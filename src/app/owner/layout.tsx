import { SessionProvider } from "@/components/auth/session-provider";
import { requirePortal } from "@/lib/auth/session";

import { PortalShell } from "./portal-shell";

/**
 * Server guard for the owner portal. Everything below this segment assumes a
 * signed-in owner; `requirePortal` redirects anyone else before the shell
 * renders, so no page under here repeats the check.
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePortal("owner");

  return (
    <SessionProvider session={session}>
      <PortalShell>{children}</PortalShell>
    </SessionProvider>
  );
}
