import "server-only";

import { cookies } from "next/headers";

/**
 * Same idea as `queue/cookie.ts`: customers never log in, so "this is my
 * booking" is an httpOnly cookie set when they book. The booking id is the
 * capability — public snapshots never carry anyone else's, and the Realtime
 * poke carries none.
 */
const COOKIE = "bf_booking";

/** Long enough to cover the furthest a customer can book ahead. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 62;

export async function readOwnBookingId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Only callable from a Server Action — Server Components cannot set cookies. */
export async function rememberOwnBooking(bookingId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, bookingId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}
