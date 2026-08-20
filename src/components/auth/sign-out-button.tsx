"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { useAppStore } from "@/lib/store/app-store";

/**
 * Real sign out: clears the Supabase cookies on the server, then drops the
 * mirrored session from the store so nothing on screen still thinks it knows
 * who the user is.
 *
 * `replace` rather than `push` so Back cannot return to the portal — the guard
 * would bounce them out again, but only after briefly rendering the shell.
 */
export function SignOutButton({
  label = "Sign out",
  onNavigate,
  variant = "ghost",
  size = "sm",
  className = "w-full justify-start",
}: {
  label?: string;
  onNavigate?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    onNavigate?.();
    startTransition(async () => {
      await signOut();
      setSession(null);
      router.replace("/");
    });
  }

  return (
    <Button
      variant={variant}
      className={className}
      size={size}
      onClick={handleSignOut}
      disabled={pending}
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out…" : label}
    </Button>
  );
}
