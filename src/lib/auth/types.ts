/**
 * Lives outside actions.ts because a `"use server"` module may only export
 * async functions — every other export there becomes a callable endpoint.
 */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };
