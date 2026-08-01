"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Old /auth/login links → team login, or /platform for super-admin. */
function RedirectLogin() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const role = params.get("role");
    if (role === "super-admin") {
      router.replace("/platform");
      return;
    }
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/");
  }, [params, router]);

  return <div className="app-bg min-h-dvh" />;
}

export default function LoginRedirectPage() {
  return (
    <Suspense fallback={<div className="app-bg min-h-dvh" />}>
      <RedirectLogin />
    </Suspense>
  );
}
