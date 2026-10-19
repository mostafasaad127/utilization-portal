import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at startup. A misconfigured deployment
 * fails fast with a readable error instead of misbehaving at request time.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.string().url(),
    ENTRA_TENANT_ID: z.string().optional().default(""),
    ENTRA_CLIENT_ID: z.string().optional().default(""),
    ENTRA_CLIENT_SECRET: z.string().optional().default(""),
    AUTH_ALLOWED_DOMAINS: z.string().default("pwc.com"),
    AUTH_BOOTSTRAP_ADMINS: z.string().optional().default(""),
    AUTH_DEV_LOGIN: z.string().optional().default("false"),
    // Hosted demo before SSO exists: seeded personas sign in with AUTH_DEV_PASSWORD and
    // every page shows a demo banner. Ignored as soon as Entra ID is configured.
    AUTH_DEMO_LOGIN: z.string().optional().default("false"),
    AUTH_DEV_PASSWORD: z.string().optional().default(""),
    // Header carrying the real client IP, set by your ingress. Client-supplied values
    // of other headers are ignored. Azure Front Door: "x-azure-clientip".
    TRUSTED_IP_HEADER: z.string().trim().toLowerCase().default("x-real-ip"),
    // "true": Entra app roles (Portal.Admin) are the source of truth, re-synced at every sign-in.
    // "false": roles are managed in the portal (Users & roles page and invitations).
    AUTH_ROLES_FROM_ENTRA: z.string().optional().default("false"),
    // "true": only people an admin has invited (or bootstrap admins) can sign in.
    AUTH_INVITE_ONLY: z.string().optional().default("false"),
  })
  .superRefine((v, ctx) => {
    const entra = [v.ENTRA_TENANT_ID, v.ENTRA_CLIENT_ID, v.ENTRA_CLIENT_SECRET];
    const someEntra = entra.some(Boolean);
    if (someEntra && !entra.every(Boolean)) {
      ctx.addIssue({
        code: "custom",
        message: "ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET must be set together",
      });
    }
    if (v.ENTRA_TENANT_ID && ["common", "organizations", "consumers"].includes(v.ENTRA_TENANT_ID)) {
      ctx.addIssue({
        code: "custom",
        message: "ENTRA_TENANT_ID must be the PwC tenant GUID, not a multi-tenant alias",
      });
    }
    // Enforced when the server starts, not while `next build` collects pages.
    const building = process.env.NEXT_PHASE === "phase-production-build";
    const demo = v.AUTH_DEMO_LOGIN === "true";
    if (v.NODE_ENV === "production" && !someEntra && !demo && !building) {
      ctx.addIssue({ code: "custom", message: "Microsoft Entra ID must be configured in production (or AUTH_DEMO_LOGIN=true for a demo)" });
    }
    if (demo && !someEntra && !building && (v.AUTH_DEV_PASSWORD ?? "").length < 12) {
      ctx.addIssue({ code: "custom", message: "AUTH_DEMO_LOGIN needs AUTH_DEV_PASSWORD of at least 12 characters" });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".") || "env"}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

const raw = parsed.data;

const list = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  entraConfigured: Boolean(raw.ENTRA_TENANT_ID && raw.ENTRA_CLIENT_ID && raw.ENTRA_CLIENT_SECRET),
  /** Hosted demo: only while Entra is not configured, so it can't linger once SSO goes live. */
  demoMode: raw.AUTH_DEMO_LOGIN === "true" && !(raw.ENTRA_TENANT_ID && raw.ENTRA_CLIENT_ID && raw.ENTRA_CLIENT_SECRET),
  /** Persona password sign-in: local development, or an explicit hosted demo. */
  devLoginEnabled:
    (raw.NODE_ENV !== "production" && raw.AUTH_DEV_LOGIN === "true") ||
    (raw.AUTH_DEMO_LOGIN === "true" && !(raw.ENTRA_TENANT_ID && raw.ENTRA_CLIENT_ID && raw.ENTRA_CLIENT_SECRET)),
  allowedDomains: list(raw.AUTH_ALLOWED_DOMAINS),
  rolesFromEntra: raw.AUTH_ROLES_FROM_ENTRA === "true",
  inviteOnly: raw.AUTH_INVITE_ONLY === "true",
  bootstrapAdmins: list(raw.AUTH_BOOTSTRAP_ADMINS),
};
