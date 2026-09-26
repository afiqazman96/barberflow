/**
 * The address customers and new owners should be sent to. `NEXT_PUBLIC_APP_URL`
 * wins so a link or QR made from any machine (even localhost) still points at
 * the live site.
 */
export function publicOrigin(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return fromEnv || undefined;
}

/** True for addresses only this computer or its network can open. */
export function isPrivateOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(origin);
}

/** The site's own address, as best this browser can tell. */
export function siteOrigin(): string {
  return (
    publicOrigin() ??
    (typeof window !== "undefined" ? window.location.origin : "https://barberflow.app")
  );
}
