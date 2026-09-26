import type { OwnerAccount, Tenant } from "@/lib/types";
import { todayIso } from "@/lib/utils";

/**
 * Tenant onboarding: the account a new shop owner signs in with, and the words
 * used to hand it over.
 *
 * `issueOwnerAccount` is the one seam to the backend. Today it only makes up a
 * temporary password in the browser (`provisioned: false`), so nothing can sign
 * in with it yet. When tenant provisioning exists on the server, replace the
 * body with the server action that creates the Supabase login + owner row and
 * returns the same shape — the screens above it do not change.
 */

// No 0/O, 1/l/I: the password gets read out or retyped from a chat message.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword(): string {
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]);
  // kR7m-Qp2x-Hw9d — grouped so it is easy to read aloud.
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}

export function issueOwnerAccount(email: string): OwnerAccount {
  return {
    loginEmail: email.trim().toLowerCase(),
    tempPassword: generateTempPassword(),
    mustChangePassword: true,
    status: "awaiting-first-login",
    issuedAt: new Date().toISOString(),
    provisioned: false,
  };
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Why this owner email can't be used for a new tenant, or null when it can. */
export function ownerEmailProblem(
  email: string,
  tenants: Tenant[],
  ignoreTenantId?: string,
): string | null {
  if (!isValidEmail(email)) return "Enter a valid email address";
  const key = email.trim().toLowerCase();
  const taken = tenants.find(
    (t) => !t.archived && t.id !== ignoreTenantId && t.ownerEmail.toLowerCase() === key,
  );
  return taken ? `${taken.name} already uses this email` : null;
}

export function isTrialExpired(tenant: Pick<Tenant, "status" | "trialEndsAt">): boolean {
  return tenant.status === "trial" && !!tenant.trialEndsAt && tenant.trialEndsAt < todayIso();
}

export function welcomeMessage(input: {
  ownerName: string;
  businessName: string;
  loginUrl: string;
  email: string;
  tempPassword: string;
  plan: string;
  trialEndsAt?: string;
}): string {
  const first = input.ownerName.trim().split(/\s+/)[0] || "there";
  const lines = [
    `Hi ${first}, your BarberFlow account for ${input.businessName} is ready.`,
    "",
    `Sign in: ${input.loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.tempPassword}`,
    "",
    "You'll be asked to choose your own password the first time you sign in.",
    input.trialEndsAt
      ? `Your ${input.plan} plan starts with a free trial until ${input.trialEndsAt}.`
      : `You're on the ${input.plan} plan.`,
  ];
  return lines.join("\n");
}
