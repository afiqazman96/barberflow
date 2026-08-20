import { redirectIfSignedIn } from "@/lib/auth/session";

import { PlatformLoginForm } from "./login-form";

export default async function PlatformLoginPage() {
  await redirectIfSignedIn();

  return <PlatformLoginForm />;
}
