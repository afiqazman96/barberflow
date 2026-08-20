import { redirectIfSignedIn } from "@/lib/auth/session";

import { TeamLoginForm } from "./login-form";

/**
 * Team sign in. A Server Component so an already-signed-in visitor is sent
 * straight to their portal instead of watching the form flash first.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  await redirectIfSignedIn();

  const { email } = await searchParams;

  return <TeamLoginForm defaultEmail={email ?? ""} />;
}
