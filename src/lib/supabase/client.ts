"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client for Client Components. `createBrowserClient` memoises the
 * underlying instance, so calling this per component is fine — you do not need
 * to hoist it into a context.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
