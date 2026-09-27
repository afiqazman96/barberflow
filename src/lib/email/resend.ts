import "server-only";

import type { EmailResult } from "./types";

/**
 * Sends one email through Resend's REST API.
 *
 * Configuration (server-only env — never prefix with NEXT_PUBLIC_):
 *   RESEND_API_KEY  the API key from the Resend dashboard
 *   EMAIL_FROM      sender on a domain verified in Resend,
 *                   e.g. `BarberFlow <hello@yourdomain.com>`
 *   EMAIL_REPLY_TO  optional reply-to address
 *   EMAIL_DRY_RUN   set to `1` to log emails to the server console instead of
 *                   sending them — for development and demos without a key
 *
 * Without a key and sender this returns `notConfigured` rather than throwing,
 * so a missing setup shows the user a message and never breaks checkout.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Repeat sends with the same key within 24h are ignored by Resend. */
  idempotencyKey?: string;
}): Promise<EmailResult> {
  if (process.env.EMAIL_DRY_RUN === "1") {
    console.info(
      `[email:dry-run] to=${input.to}\n  subject: ${input.subject}\n${input.text
        .split("\n")
        .map((l) => `  | ${l}`)
        .join("\n")}`,
    );
    return { ok: true, dryRun: true };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, notConfigured: true, error: "Email isn't set up yet" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (input.idempotencyKey) {
    headers["Idempotency-Key"] = input.idempotencyKey.slice(0, 256);
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(process.env.EMAIL_REPLY_TO?.trim()
          ? { reply_to: process.env.EMAIL_REPLY_TO.trim() }
          : {}),
      }),
      // A stuck provider must not hold a checkout or a form open.
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (res.ok) return { ok: true };

    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    const detail = body?.message?.slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "The email service rejected our API key" };
    }
    if (res.status === 429) {
      return { ok: false, error: "Too many emails just now — try again in a moment" };
    }
    // 422 and friends carry a readable reason, e.g. an unverified sender domain.
    return { ok: false, error: detail ?? `The email service returned ${res.status}` };
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? "The email service took too long to answer"
        : "Could not reach the email service",
    };
  }
}
