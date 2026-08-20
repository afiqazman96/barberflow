import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Supabase access tokens are short-lived. Server Components cannot write
 * cookies, so without a refresh here every server render would eventually see
 * an expired token and log the user out. This runs before each matched
 * request, refreshes the token if needed, and writes the new cookies onto both
 * the request (so this render sees them) and the response (so the browser
 * keeps them).
 *
 * Next.js 16 renamed Middleware to Proxy; the file must be `src/proxy.ts` and
 * export `proxy`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token against Supabase. Do not swap this for
  // getSession(), which trusts the cookie without verifying it, and do not run
  // code between createServerClient and here — a stray early return would skip
  // the refresh and cause random sign-outs.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. Auth pages are
     * deliberately included so their cookies stay fresh too.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
