import { SessionProvider } from "@/components/auth/session-provider";
import { requirePortal } from "@/lib/auth/session";

import { PortalShell } from "./portal-shell";

/**
 * Server guard for the internal platform console. Shop staff who land here are
 * bounced back to their own portal — platform admins are rows in
 * `platform_admins`, not staff of any tenant.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePortal("super-admin");

  return (
    <SessionProvider session={session}>
      <PortalShell>{children}</PortalShell>
    </SessionProvider>
  );
}
