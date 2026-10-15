"use client";

import { createContext, useContext, useEffect } from "react";

import type { SessionUser } from "@/lib/auth/dto";
import { ForcePasswordChange } from "@/components/auth/force-password-change";
import { ImpersonationBanner } from "@/components/auth/impersonation-banner";
import { SuspendedScreen } from "@/components/auth/suspended-screen";
import { usePlatformStore } from "@/lib/store/platform-store";
import { useAppStore } from "@/lib/store/app-store";

const SessionContext = createContext<SessionUser | null>(null);

/**
 * Carries the server-verified session down into the portal's Client
 * Components.
 *
 * This is context rather than a store write because context is readable on the
 * very first render: a `useEffect` sync would leave one paint where the portal
 * does not yet know who is signed in, and the staff screens would briefly
 * render somebody else's numbers. The store is still mirrored (below) for the
 * screens that read `role` / `staffId` from it.
 *
 * The value here is display state, not authorisation. Every guard and every
 * mutation resolves the session on the server; nothing trusts this copy.
 */
export function SessionProvider({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const setSession = useAppStore((s) => s.setSession);
  const myTenant = usePlatformStore((s) => s.myTenant);
  const loadMyTenant = usePlatformStore((s) => s.loadMyTenant);
  const isShopRole =
    session.role === "owner" || session.role === "cashier" || session.role === "staff";

  useEffect(() => {
    if (isShopRole) void loadMyTenant();
  }, [isShopRole, loadMyTenant]);

  // When a tenant's subscription is suspended in Super Admin, its shop
  // portals stop working — checked here since this wraps every one of them.
  const shopSuspended = isShopRole && myTenant?.status === "suspended";

  useEffect(() => {
    // `session` is a fresh object on every server render, so compare contents:
    // re-setting an identical session would wake every subscriber for nothing.
    const current = useAppStore.getState().session;
    if (
      current?.authUserId === session.authUserId &&
      current.mustChangePassword === session.mustChangePassword
    ) {
      return;
    }
    setSession(session);
  }, [session, setSession]);

  return (
    <SessionContext.Provider value={session}>
      {session.impersonation && (
        <ImpersonationBanner
          platformAdminName={session.impersonation.platformAdminName}
          startedAt={session.impersonation.startedAt}
        />
      )}
      {session.mustChangePassword ? (
        <ForcePasswordChange />
      ) : shopSuspended ? (
        <SuspendedScreen shopName={myTenant?.name ?? "This shop"} />
      ) : (
        children
      )}
    </SessionContext.Provider>
  );
}

/** The signed-in user. Only valid inside a portal — those all have a guard above. */
export function useSession(): SessionUser {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used inside a guarded portal layout");
  }
  return session;
}
