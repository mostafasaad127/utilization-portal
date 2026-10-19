/**
 * Pure authorisation rules shared by the server auth config, the sign-in flow
 * and tests. No framework imports so it can be unit tested in isolation.
 */
export const ROLES = ["ADMIN", "EMPLOYEE"] as const;
export type AppRole = (typeof ROLES)[number];

const RANK: Record<AppRole, number> = { EMPLOYEE: 0, ADMIN: 1 };

export function hasRole(actual: AppRole, required: AppRole) {
  return RANK[actual] >= RANK[required];
}

export function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/** Exact domain match, or a subdomain of an allowed domain (e.g. uk.pwc.com). */
export function isAllowedEmail(email: string, allowedDomains: string[]) {
  const domain = emailDomain(email);
  if (!domain) return false;
  return allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/**
 * Maps Microsoft Entra ID app-role values (the `roles` claim) to portal roles.
 * Configure these app roles on the app registration and assign them to
 * security groups. Returns null when the token carries no portal role.
 */
export const ENTRA_APP_ROLES: Record<string, AppRole> = {
  "Portal.Admin": "ADMIN",
  "Portal.User": "EMPLOYEE",
};

export function roleFromEntraClaims(roles: unknown): AppRole | null {
  if (!Array.isArray(roles)) return null;
  const mapped = roles
    .map((r) => (typeof r === "string" ? ENTRA_APP_ROLES[r] : undefined))
    .filter((r): r is AppRole => Boolean(r));
  if (mapped.length === 0) return null;
  return mapped.reduce((best, r) => (RANK[r] > RANK[best] ? r : best));
}
