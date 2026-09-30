import "server-only";

import { cookies } from "next/headers";

/**
 * Customers never log in, so "this is my ticket" is carried by an httpOnly
 * cookie set when they join. The ticket id is the capability: it is never
 * sent to another customer (public snapshots replace other people's ids, and
 * the Realtime poke carries none), so holding it means you joined with it.
 */
const COOKIE = "bf_queue_ticket";

/** A ticket only matters for the day it was issued. */
const MAX_AGE_SECONDS = 60 * 60 * 24;

export async function readOwnTicketId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Only callable from a Server Action — Server Components cannot set cookies. */
export async function rememberOwnTicket(ticketId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, ticketId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
