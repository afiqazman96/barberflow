/**
 * Reading Supabase env vars through these helpers rather than `process.env`
 * directly means a missing value fails loudly at the call site instead of
 * surfacing later as an opaque "Invalid API key" from the Supabase SDK.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in from the Supabase dashboard.`,
    );
  }
  return value;
}

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when the
 * property is accessed literally, so these two cannot be looked up dynamically.
 */
export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/**
 * Supabase now issues `sb_publishable_…` keys; older projects have a JWT-shaped
 * `anon` key. Both go in the same slot, so accept either name and prefer the
 * new one.
 */
export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server-only. Bypasses every auth check — never reach for this in the browser. */
export function supabaseServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
