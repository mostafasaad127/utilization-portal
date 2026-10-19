"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, FormAlert, Input } from "@/components/ui/form";
import { resolveSignInMethod } from "./actions";

const DEV_PERSONAS = [
  { email: "admin@pwc.com", role: "Admin" },
  { email: "rana.zaki@pwc.com", role: "Employee" },
  { email: "farida.lotfy@pwc.com", role: "Employee" },
];

export function SignInForm({
  returnTo,
  initialError,
  ssoEnabled,
  devLogin,
  demo = false,
}: {
  returnTo: string;
  initialError?: string;
  ssoEnabled: boolean;
  devLogin: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(initialError);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const passwordRef = useRef<HTMLInputElement>(null);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await resolveSignInMethod(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.method === "entra") {
        setRedirecting(true);
        // Hand off to Microsoft Entra ID; login_hint pre-fills the account,
        // domain_hint skips the account picker for the PwC tenant.
        const { error: err } = await authClient.signIn.social({
          provider: "microsoft",
          callbackURL: returnTo,
          errorCallbackURL: "/sign-in",
          loginHint: result.email,
          additionalParams: { domain_hint: result.domain },
        });
        if (err) {
          setRedirecting(false);
          setError("We couldn't reach PwC single sign-on. Please try again.");
        }
        return;
      }
      setEmail(result.email);
      setStep("password");
      requestAnimationFrame(() => passwordRef.current?.focus());
    });
  }

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) {
        setError(err.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      {error && (
        <div className="mb-5">
          <FormAlert tone="error">{error}</FormAlert>
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={submitEmail} noValidate className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="firstname.lastname@pwc.com"
              aria-invalid={Boolean(error) || undefined}
              className="h-12"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending || redirecting} disabled={!email.trim()}>
            {redirecting ? "Redirecting to PwC sign-in…" : "Continue"}
          </Button>
          <p className="flex items-start gap-2 text-sm text-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {ssoEnabled
              ? "You'll be signed in with your PwC account through PwC single sign-on (Microsoft Entra ID). Multi-factor authentication applies."
              : "Sign in with your PwC email address."}
          </p>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setPassword("");
              setError(undefined);
            }}
            className="flex items-center gap-2 self-start rounded-sm text-sm text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> {email}
          </button>
          {demo && (
            <FormAlert tone="error">Demo environment: use the demo password you were given. Never enter your real PwC password here.</FormAlert>
          )}
          <Field label="Password" htmlFor="password" required>
            <Input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error) || undefined}
              className="h-12"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!password}>
            Sign in
          </Button>
        </form>
      )}

      {devLogin && (
        <div className="mt-8 rounded-md border border-dashed border-line-strong/50 bg-container p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-heading">
            <KeyRound className="size-4 text-primary" aria-hidden /> {demo ? "Demo sign-in" : "Local development sign-in"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {demo ? (
              <>This is a demo environment with sample data. Sign in as one of the demo personas using the password you were given. PwC single sign-on replaces this when it&apos;s set up.</>
            ) : (
              <>
                Entra ID isn&apos;t configured, so seeded personas sign in with the password set in <code>AUTH_DEV_PASSWORD</code>. It is
                always disabled in production.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEV_PERSONAS.map((p) => (
              <button
                key={p.email}
                type="button"
                onClick={() => {
                  setEmail(p.email);
                  setStep("email");
                  setError(undefined);
                }}
                className="rounded-sm bg-container-alt px-2.5 py-1 text-xs text-body hover:bg-selected"
              >
                {p.role} · {p.email}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
