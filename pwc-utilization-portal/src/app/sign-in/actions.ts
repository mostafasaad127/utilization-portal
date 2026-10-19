"use server";

import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { emailDomain, isAllowedEmail } from "@/lib/auth-policy";

export type SignInMethod =
  | { ok: true; method: "entra"; email: string; domain: string }
  | { ok: true; method: "password"; email: string }
  | { ok: false; error: string };

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Step one of the email-first sign-in (home-realm discovery, as PwC Identity
 * does it): decide which identity provider handles this address. Responses
 * are the same for every disallowed address so they don't reveal anything
 * about which accounts exist.
 */
export async function resolveSignInMethod(rawEmail: string): Promise<SignInMethod> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data;

  if (!isAllowedEmail(email, env.allowedDomains)) {
    return { ok: false, error: "Use your PwC email address to sign in." };
  }
  if (env.entraConfigured) return { ok: true, method: "entra", email, domain: emailDomain(email) };
  if (env.devLoginEnabled) {
    // In a hosted demo only the demo accounts can sign in, so nobody is prompted
    // for a password with their real PwC address.
    if (env.demoMode) {
      const demoAccount = await db.account.findFirst({ where: { providerId: "credential", user: { email, isActive: true } }, select: { id: true } });
      if (!demoAccount) return { ok: false, error: "This is a demo with demo accounts only. Pick one of the demo personas below." };
    }
    return { ok: true, method: "password", email };
  }
  return { ok: false, error: "Single sign-on is not configured. Contact the portal administrator." };
}
