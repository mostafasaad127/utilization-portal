import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PwcLogo } from "@/components/brand/logo";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { SignInForm } from "./sign-in-form";
import { LoginArtwork } from "./login-artwork";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Only same-origin relative paths are accepted, preventing open redirects.
 * Control characters and backslashes are rejected because browsers strip or
 * normalise them (e.g. "/\t/evil.com" becomes "//evil.com").
 */
function safeReturnTo(value: string | string[] | undefined) {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || v.length > 2000 || !v.startsWith("/") || v.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(v)) return "/";
  try {
    const base = new URL("http://portal.invalid");
    const url = new URL(v, base);
    return url.origin === base.origin ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  forbidden: "Your account is not authorised to use the portal.",
  unable_to_create_user: "Your account is not authorised to use the portal.",
  account_not_linked: "This sign-in method isn't linked to your account.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  if (await getCurrentUser()) redirect(returnTo);

  const errorCode = typeof params.error === "string" ? params.error.toLowerCase() : undefined;
  const initialError = errorCode ? (ERROR_MESSAGES[errorCode] ?? "We couldn't sign you in. Please try again.") : undefined;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
      <div className="flex flex-col bg-page px-6 py-8 sm:px-12 lg:px-20">
        <PwcLogo className="h-11 w-auto self-start text-heading" />

        <div className="my-auto w-full max-w-[34rem] py-12">
          <p className="text-xl font-medium text-muted">Welcome to</p>
          <h1 className="mt-1 text-[2.5rem] leading-[3rem] font-medium sm:text-5xl sm:leading-[3.5rem]">Utilization Portal</h1>
          <p className="mt-3 text-base text-body">
            Projects, team allocation and utilization for Tech Catalyst and Digital Consulting, in one place.
          </p>

          <SignInForm
            returnTo={returnTo}
            initialError={initialError}
            ssoEnabled={env.entraConfigured}
            devLogin={env.devLoginEnabled && !env.entraConfigured}
            demo={env.demoMode}
          />
        </div>

        <footer className="text-xs leading-5 text-muted">
          © {new Date().getFullYear()} PwC. All rights reserved. PwC refers to the PwC network and/or one or more of its member
          firms, each of which is a separate legal entity. For internal use by authorised PwC personnel only. Access and use are
          monitored.
        </footer>
      </div>

      <LoginArtwork />
    </div>
  );
}
