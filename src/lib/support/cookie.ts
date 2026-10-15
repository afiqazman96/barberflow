import "server-only";

import { cookies } from "next/headers";

/**
 * Same idea as `bookings/cookie.ts`: the cookie carries only an opaque
 * SupportSession id, never a raw tenantId/staffId — so it can't be
 * hand-edited to claim a different tenant. The row it points at is looked
 * up fresh, server-side, on every request.
 */
const COOKIE = "bf_support_session";

export async function readSupportSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setSupportSessionCookie(id: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSupportSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
