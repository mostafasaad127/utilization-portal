import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { hasRole, type AppRole } from "@/lib/auth-policy";

/**
 * Data Access Layer for identity. Every page, Server Action and Route Handler
 * resolves the user through these helpers — authorisation is enforced next to
 * the data, never only in the proxy or the UI.
 */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  personId: string | null;
};

/** Per-request memoised: the session is read once however many components ask. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // Re-read role and status from the database rather than trusting session data.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, person: { select: { id: true } } },
  });
  if (!user || !user.isActive) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, personId: user.person?.id ?? null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireRole(role: AppRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.role, role)) forbidden();
  return user;
}

export function can(user: CurrentUser, role: AppRole) {
  return hasRole(user.role, role);
}

export async function requestMeta() {
  const h = await headers();
  return {
    // Only the header set by our ingress is trusted; X-Forwarded-For's first hop is client-controlled.
    ipAddress: h.get(env.TRUSTED_IP_HEADER)?.split(",").pop()?.trim().slice(0, 64) || null,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}
