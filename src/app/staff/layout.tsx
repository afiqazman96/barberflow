import { SessionProvider } from "@/components/auth/session-provider";
import { requirePortal } from "@/lib/auth/session";

import { PortalShell } from "./portal-shell";

/**
 * Server guard for the staff portal. Everything below this segment assumes a
 * signed-in staff; `requirePortal` redirects anyone else before the shell
 * renders, so no page under here repeats the check.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePortal("staff");

  return (
    <SessionProvider session={session}>
      <PortalShell>{children}</PortalShell>
    </SessionProvider>
  );
}
