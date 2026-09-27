"use client";

import { toast } from "sonner";

import type { Tenant } from "@/lib/types";
import { formatDate } from "@/lib/utils";

import { emailTenantOwnerWelcome } from "./actions";

/**
 * Emails the owner of a tenant their sign-in details and tells the user how it
 * went. Needs the temporary password, which only exists while it is on screen.
 * Never throws.
 */
export async function sendTenantWelcomeEmail(tenant: Tenant): Promise<boolean> {
  const account = tenant.ownerAccount;
  if (!account?.tempPassword) {
    toast.error("No temporary password to send", {
      description: "Issue a new one first, then email it",
    });
    return false;
  }
  try {
    const result = await emailTenantOwnerWelcome({
      ownerName: tenant.ownerName,
      ownerEmail: account.loginEmail,
      businessName: tenant.name,
      plan: tenant.plan,
      trialEndsAt:
        tenant.status === "trial" && tenant.trialEndsAt
          ? formatDate(tenant.trialEndsAt)
          : undefined,
      tempPassword: account.tempPassword,
    });
    if (result.ok) {
      toast.success(result.dryRun ? "Login emailed (test mode)" : "Login emailed to the owner", {
        description: account.loginEmail,
      });
      return true;
    }
    if (result.notConfigured) {
      toast.message("Email isn't set up yet", {
        description: "Use Copy welcome message and send it yourself.",
      });
      return false;
    }
    toast.error("Couldn't email the owner", { description: result.error });
    return false;
  } catch {
    toast.error("Couldn't email the owner", {
      description: "Check the connection and try again",
    });
    return false;
  }
}
