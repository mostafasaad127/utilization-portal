import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isAllowedEmail, roleFromEntraClaims } from "@/lib/auth-policy";
import { ensurePersonForUser } from "@/lib/people";

/**
 * Authentication
 * ──────────────
 * Production: OpenID Connect against the PwC Microsoft Entra ID tenant
 * (authorization code flow + PKCE, state and nonce handled by Better Auth).
 * Accounts are keyed on the immutable `oid` claim. Portal roles come from
 * Entra app roles (`roles` claim) and are re-synced on every sign-in.
 *
 * Local development: when Entra is not configured, an email/password sign-in
 * for seeded personas is available. It cannot be enabled in production
 * builds (see `env.devLoginEnabled`).
 *
 * Sessions are opaque tokens stored server-side in Postgres, so an admin can
 * revoke them instantly. No session cookie cache: every request is checked
 * against the database, so deactivations and role changes apply immediately.
 */
export const auth = betterAuth({
  appName: "Utilization Portal",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: env.devLoginEnabled,
    disableSignUp: true, // personas are created by the seed script only
    minPasswordLength: 12,
  },

  socialProviders: env.entraConfigured
    ? {
        microsoft: {
          clientId: env.ENTRA_CLIENT_ID,
          clientSecret: env.ENTRA_CLIENT_SECRET,
          tenantId: env.ENTRA_TENANT_ID, // single tenant: only PwC identities
          disableProfilePhoto: true, // avoid large base64 payloads in the user row
          // Sign-in only needs identity claims; no Microsoft Graph access is requested.
          disableDefaultScope: true,
          scope: ["openid", "profile", "email"],
          overrideUserInfoOnSignIn: true, // keep the display name in sync with Entra
          // Role is NOT mapped here: Better Auth drops `input: false` fields from
          // provider profiles. It is synced from the verified ID token in the
          // account hooks below instead.
          mapProfileToUser: (profile) => ({
            name: profile.name,
            email: (profile.email ?? profile.preferred_username)?.toLowerCase(),
            emailVerified: true,
          }),
        },
      }
    : {},

  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "EMPLOYEE", input: false },
      isActive: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },

  account: {
    // Never merge an SSO identity into an existing account by email alone.
    accountLinking: { enabled: false },
    encryptOAuthTokens: true, // tokens at rest are encrypted with BETTER_AUTH_SECRET
  },

  // Endpoints this app never uses are switched off to shrink the attack surface
  // (e.g. users must not rename themselves, and tokens never reach the browser).
  disabledPaths: [
    "/update-user",
    "/change-email",
    "/change-password",
    "/set-password",
    "/delete-user",
    "/get-access-token",
    "/refresh-token",
    "/account-info",
    "/link-social",
    "/unlink-account",
    "/list-accounts",
    "/request-password-reset",
    "/reset-password",
    "/sign-up/email",
  ],

  session: {
    expiresIn: 60 * 60 * 8, // one working day
    updateAge: 60 * 60, // slide the expiry at most once an hour
    freshAge: 60 * 15,
  },

  rateLimit: {
    enabled: true,
    storage: "database", // shared across instances
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-in/social": { window: 60, max: 10 },
    },
  },

  onAPIError: {
    errorURL: "/sign-in", // OAuth callback errors return to the sign-in page as ?error=
  },

  advanced: {
    cookiePrefix: "pwc-up",
    useSecureCookies: env.isProduction,
    // The header your ingress sets to the real client IP (see TRUSTED_IP_HEADER).
    ipAddress: { ipAddressHeaders: [env.TRUSTED_IP_HEADER] },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase();
          const forbidden = () =>
            // `code` makes the OAuth callback redirect to /sign-in?error=forbidden instead of returning JSON.
            new APIError("FORBIDDEN", { message: "This account is not authorised for the portal.", code: "FORBIDDEN" });
          if (!isAllowedEmail(email, env.allowedDomains)) throw forbidden();

          const invite = await db.invitation.findFirst({ where: { email, revokedAt: null } });
          const bootstrap = env.bootstrapAdmins.includes(email);
          if (env.inviteOnly && !invite && !bootstrap) throw forbidden();

          const data: Record<string, unknown> = { ...user, email };
          if (invite) data.role = invite.role; // role chosen by the admin who added them
          if (bootstrap) data.role = "ADMIN";
          return { data: data as typeof user };
        },
        after: async (user) => {
          // Every login maps to a resource record: link the one with the same
          // email, or create it, so employees can log their own work straight away.
          await ensurePersonForUser({ id: user.id, name: user.name, email: user.email });
          await db.invitation.updateMany({
            where: { email: user.email.toLowerCase(), acceptedAt: null, revokedAt: null },
            data: { acceptedAt: new Date() },
          });
        },
      },
    },
    account: {
      // Better Auth updates the account row (fresh, verified tokens) on every
      // SSO sign-in, so roles follow Entra app-role assignments, including demotions.
      create: { after: async (account) => syncRoleFromIdToken(account) },
      update: { after: async (account) => syncRoleFromIdToken(account) },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true, email: true },
          });
          if (!user || !user.isActive || !isAllowedEmail(user.email, env.allowedDomains)) {
            throw new APIError("FORBIDDEN", { message: "Your access to the portal has been disabled.", code: "FORBIDDEN" });
          }
        },
        after: async (session) => {
          await db.$transaction([
            db.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } }),
            db.auditLog.create({
              data: {
                actorId: session.userId,
                action: "auth.sign_in",
                entityType: "user",
                entityId: session.userId,
                summary: "Signed in",
                ipAddress: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
              },
            }),
          ]);
        },
      },
    },
  },

  plugins: [nextCookies()], // must stay last
});

export type AuthSession = typeof auth.$Infer.Session;

/**
 * Reads the `roles` claim from the ID token Better Auth has just verified
 * (signature, issuer, audience, nonce) and applies it to the user. Users with
 * no portal app role are set to EMPLOYEE, so removal in Entra revokes admin rights.
 * Bootstrap admins keep ADMIN until Entra app roles are configured for them.
 */
async function syncRoleFromIdToken(account: { providerId?: string | null; userId?: string | null; idToken?: string | null }) {
  // Only when Entra app roles are the configured source of truth; otherwise roles
  // are managed in the portal and an Entra token without roles must not demote anyone.
  if (!env.rolesFromEntra) return;
  if (account.providerId !== "microsoft" || !account.userId || !account.idToken) return;
  const claims = decodeJwtPayload(account.idToken);
  if (!claims) return;
  const user = await db.user.findUnique({ where: { id: account.userId }, select: { role: true, email: true } });
  if (!user) return;
  const fromEntra = roleFromEntraClaims(claims.roles);
  const role = fromEntra ?? (env.bootstrapAdmins.includes(user.email.toLowerCase()) ? "ADMIN" : "EMPLOYEE");
  if (role === user.role) return;
  await db.$transaction([
    db.user.update({ where: { id: account.userId }, data: { role } }),
    db.auditLog.create({
      data: {
        actorId: account.userId,
        action: "user.role_sync",
        entityType: "user",
        entityId: account.userId,
        summary: `Role synced from Entra ID: ${user.role} → ${role}`,
        changes: { role: { from: user.role, to: role } },
      },
    }),
  ]);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  // Stored tokens may be encrypted (encryptOAuthTokens); only plain JWTs are decoded.
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
