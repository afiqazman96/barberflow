"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, KeyRound, Mail, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPrivateOrigin, siteOrigin } from "@/lib/public-origin";
import { welcomeMessage } from "@/lib/tenant-onboarding";
import type { Tenant } from "@/lib/types";
import { formatDate } from "@/lib/utils";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Could not copy", { description: "Select the text and copy it by hand" });
  }
}

function Row({
  label,
  value,
  onCopy,
  mono = true,
  children,
}: {
  label: string;
  value?: string;
  onCopy?: () => void;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-muted)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
        {children ?? (
          <p className={`break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
        )}
      </div>
      {onCopy && (
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onCopy} aria-label={`Copy ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/**
 * What a new shop owner needs to sign in, laid out so Super Admin can hand it
 * over in one go: the address, the email, the temporary password, and a
 * ready-to-send message.
 */
export function TenantCredentials({
  tenant,
  onReset,
  loginPath = "/",
}: {
  tenant: Tenant;
  /** Issue a fresh password — shown when the current one is no longer on screen. */
  onReset?: () => void;
  loginPath?: string;
}) {
  const account = tenant.ownerAccount;
  const [reveal, setReveal] = useState(false);

  if (!account) {
    return (
      <p className="rounded-xl bg-[var(--bg-muted)] px-3 py-3 text-sm text-[var(--text-muted)]">
        This tenant was created before owner logins were issued from here.
        {onReset ? " Issue one to give the owner access." : ""}
        {onReset && (
          <Button size="sm" className="mt-3 w-full" onClick={onReset}>
            <KeyRound className="h-4 w-4" />
            Issue owner login
          </Button>
        )}
      </p>
    );
  }

  const loginUrl = `${siteOrigin()}${loginPath}`;
  const message = account.tempPassword
    ? welcomeMessage({
        ownerName: tenant.ownerName,
        businessName: tenant.name,
        loginUrl,
        email: account.loginEmail,
        tempPassword: account.tempPassword,
        plan: tenant.plan,
        trialEndsAt: tenant.status === "trial" && tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : undefined,
      })
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={account.status === "active" ? "success" : "warning"}>
          {account.status === "active" ? "Owner signed in" : "Awaiting first login"}
        </Badge>
        {account.mustChangePassword && (
          <span className="text-xs text-[var(--text-faint)]">
            Owner sets their own password on first sign-in
          </span>
        )}
      </div>

      <Row label="Sign-in page" value={loginUrl} onCopy={() => copy(loginUrl, "Link")} />
      {isPrivateOrigin(loginUrl) && (
        <p className="-mt-1 px-1 text-xs text-[var(--warning)]">
          This address only opens on this computer. Open BarberFlow from the
          live website (or set NEXT_PUBLIC_APP_URL) before sending it.
        </p>
      )}
      <Row label="Email (username)" value={account.loginEmail} onCopy={() => copy(account.loginEmail, "Email")} mono={false} />
      {account.tempPassword ? (
        <Row label="Temporary password" onCopy={() => copy(account.tempPassword!, "Password")}>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm tracking-wide">
              {reveal ? account.tempPassword : "••••-••••-••••"}
            </p>
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="text-[var(--text-faint)] hover:text-[var(--text)]"
              aria-label={reveal ? "Hide password" : "Show password"}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Row>
      ) : (
        <div className="rounded-xl bg-[var(--bg-muted)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
          The temporary password is only shown when it is issued and isn&apos;t
          kept. Issue a new one to send again.
          {onReset && (
            <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={onReset}>
              <KeyRound className="h-4 w-4" />
              Issue new temporary password
            </Button>
          )}
        </div>
      )}

      {message && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => copy(message, "Welcome message")}>
            <MessageSquareText className="h-4 w-4" />
            Copy welcome message
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <a
              href={`mailto:${account.loginEmail}?subject=${encodeURIComponent(
                `Your BarberFlow account for ${tenant.name}`,
              )}&body=${encodeURIComponent(message)}`}
            >
              <Mail className="h-4 w-4" />
              Write email
            </a>
          </Button>
        </div>
      )}

      {!account.provisioned && (
        <p className="flex items-start gap-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--text-muted)]">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
          Demo credentials: the owner login isn&apos;t connected to live sign-in
          yet, so this sign-in can&apos;t be used until tenant provisioning is
          switched on.
        </p>
      )}
    </div>
  );
}
