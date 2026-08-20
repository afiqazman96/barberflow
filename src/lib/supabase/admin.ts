import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role client. Bypasses every auth check, so it exists for exactly one
 * job: administering `auth.users` on behalf of a caller we have already
 * authorised ourselves — owners provisioning staff (BACKEND_HANDOFF §6.2),
 * password resets, and disabling accounts.
 *
 * Never import this from a Client Component, and never use it as a shortcut
 * for reads the anon client could do — that would silently skip tenant checks.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      // No cookies, no refresh loop: this client is never a logged-in user.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
