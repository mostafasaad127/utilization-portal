# Utilization Portal

A governed replacement for the shared **FY26/FY27 utilization spreadsheet** used by the Tech Catalyst and Digital Consulting teams. It tracks projects, who is staffed on what (and at what %), project health, risks and status updates, with PwC single sign-on, role-based access and a full audit trail.

The look and feel follows **Appkit 4**, PwC's design system (orange theme). Colour, spacing, radius, elevation and typography tokens were taken from appkit.pwc.com. Sign-in is email-first, the same way PwC Identity works.

---

## Who uses it

| Role | What they see and do |
|---|---|
| **Employee** (everyone, by default) | A **personal dashboard**: their utilization today, FY average, month-by-month strip, roll-off date, projects waiting for a status update and open risks. They **log projects** they work on (and are added to the team automatically) or **join** one a colleague already logged, and keep their own allocation, project details, risks and status updates current. They only ever see **their own** projects and figures. On a shared project they can see who their teammates are, but not teammates' allocation. |
| **Admin** | Everything: the team dashboard, every project, people, the capacity heatmap, the risk register, users and roles, reference data, spreadsheet import and the audit log. |

### Adding users

**Admin → Users & roles → Add user**: enter name, PwC email and role (plus optional capability, grade and territory). This creates an *invitation* and the person's resource record, so they can be staffed on projects straight away. Their login is created by PwC SSO on first sign-in, and they get the role you chose. Pending invitations are listed under "Waiting for first sign-in" and can be revoked. The login isn't pre-created, so an SSO identity is never linked to an account by email alone. In local development, where there is no SSO, the account can sign in immediately with `AUTH_DEV_PASSWORD`.

- `AUTH_ROLES_FROM_ENTRA=false` (default): roles are managed in the portal.
- `AUTH_ROLES_FROM_ENTRA=true`: Entra app roles are the source of truth and are re-synced at every sign-in.
- `AUTH_INVITE_ONLY=true`: only invited people (and bootstrap admins) can sign in.

Access is enforced on the server (`src/lib/access.ts`): every project query is scoped to the user, every Server Action re-checks membership, and a project an employee isn't on returns 404.

## What it does

| Area | What you get (vs. the spreadsheet) |
|---|---|
| **Dashboard** | Team utilization today, a monthly FY trend (confirmed vs pipeline), people on the bench, roll-offs in the next 30 days, Amber/Red projects, active projects by line of service |
| **Projects** | Server-side search, filters (fiscal year, status, RAG, territory, LoS, capability) and sorting in shareable URLs, plus **Export to Excel** in the original sheet's column layout |
| **Project page** | Details and scope, **team assignments** (person, capability, allocation %, dates), **risk register**, **dated status updates** (RAG history), and **change history** for every edit |
| **People** | The resource pool with today's allocation, current projects and next roll-off; filter by availability band |
| **Utilization** | Person × month **capacity heatmap** for any fiscal year, weighted by working days, with pipeline work flagged |
| **Risk register** | Every open risk across projects, highest severity first |
| **Admin** | Users & roles (revoke access, sign out sessions), reference data and resource pool, **spreadsheet import**, **audit log** |

Rules the spreadsheet couldn't enforce:
- **Fiscal year** runs 1 July – 30 June and is named after the year it ends (FY27 = Jul 2026 – Jun 2027). Projects belong to every FY they overlap, so there's no "archive" tab to keep in sync.
- **Utilization** is weighted by working days. A 100% assignment covering half a month counts as 50% for that month. Pipeline projects count as *tentative* and are shown separately.
- **Bands:** bench 0%, under-utilized 1–69%, healthy 70–99%, full 100%, over-allocated above 100%.

---

## Architecture

```
Browser ──▶ Next.js 16 (App Router, React 19, Server Components + Server Actions)
              │  src/proxy.ts      per-request CSP nonce, optimistic auth redirect
              │  src/lib/session   Data Access Layer: every page/action re-checks the session + role
              │  src/lib/auth      Better Auth ── OIDC ──▶ Microsoft Entra ID (PwC tenant)
              ▼
           Prisma 7 ──▶ PostgreSQL 17 (Azure Database for PostgreSQL in production)
```

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16.4, TypeScript (strict) | Server-rendered by default, so data never leaves the server unless a page renders it |
| Auth | **Better Auth 1.7** with the Microsoft Entra ID provider | Auth.js is now maintained by the Better Auth team, who recommend Better Auth for new projects. Accounts are keyed on Entra's immutable `oid` claim |
| Database | PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`) | Relational data with migrations; Azure-native managed service |
| UI | Tailwind CSS 4 with Appkit 4 tokens, Radix primitives (dialogs, menus), Lucide icons | Accessible primitives, PwC look. Swap in `@appkit4/react-components` if you have access to PwC's internal npm registry |
| Validation | Zod on every Server Action and URL filter | Never trust form or query input |
| Excel | ExcelJS | Import and export without macros |

### Data model

The spreadsheet stored one row per project/resource slice with free-text columns. The schema (`prisma/schema.prisma`) normalises it:

- **Project**: name, client, industry, territory, line of service, status, RAG, start/end (blank = TBD), multi-tower, engagement leads, scope. Soft-deleted only.
- **Assignment**: person × project × capability × allocation % × date range. *This replaces "Team Resources" + "Team Utilization %".*
- **Risk**: title, severity, status, owner, mitigation. *Replaces the "Risks/Challenges" text.*
- **ProjectUpdate**: dated status notes with the RAG at the time.
- **Reference data**: Territory, Capability (BA, PM, PdM, PO, SD, PD), Industry, LineOfService, Client, Person.
- **AuditLog**: append-only record of sign-ins, every mutation (with a field-level diff), exports and imports.

---

## Security model

- **SSO only in production.** OpenID Connect authorization-code flow with PKCE, state and nonce, against a **single tenant** (the PwC tenant GUID; `common` is rejected). Users enter their email first and are handed to Entra with `login_hint` and `domain_hint`, so MFA and Conditional Access policies apply.
- **Allow-listed email domains** (`AUTH_ALLOWED_DOMAINS`). Any other identity is refused at account creation and again at every session creation.
- **Roles** are managed in the portal by default (Users & roles, invitations). With `AUTH_ROLES_FROM_ENTRA=true` they come from Entra app roles instead: `Portal.Admin` → Admin. Everyone else is an Employee; `Portal.User` is optional and can be used with "assignment required". Roles are read from the verified ID token at every sign-in, so promotions *and demotions* in Entra take effect at the next sign-in. Every role change is audited.
- **Row-level access:** employees can only read and change projects they're assigned to, and only their own assignment. Teammates' allocation, the people directory, team utilization and history are admin-only.
- **Minimal surface.** Only the `openid profile email` scopes are requested (no Graph access), OAuth tokens are encrypted at rest, and Better Auth endpoints the app doesn't use (update user, tokens, account linking, password reset, sign-up) are disabled.
- **Authorization at the data layer.** Every page, Server Action and route handler calls `requireUser` / `requireRole`. The proxy only does an optimistic cookie redirect and is never relied on for security.
- **Server-side sessions** in Postgres: 8-hour lifetime, sliding hourly. There is no cookie cache, so deactivating a user or changing a role takes effect on their next request. Admins can revoke all of a user's sessions.
- **Cookies:** HttpOnly, SameSite=Lax, `__Secure-` prefixed in production. Better Auth checks the Origin header on state-changing requests.
- **Rate limiting** stored in the database, so it works across instances: 5 password attempts/min in dev; 10 SSO starts/min.
- **Strict CSP** with a per-request nonce and `strict-dynamic`, plus HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy and Permissions-Policy. `X-Powered-By` is removed.
- **Open-redirect protection** on `returnTo` (same-origin relative paths only).
- **Import hardening:** `.xlsx` only, 10 MB upload cap, zip structure check, 100 MB *uncompressed* cap read from the zip directory before decompressing, row cap per sheet, formula *results* only (never evaluated), field length limits, single transaction. Admin-only.
- **Client IP** for audit and rate limiting comes only from the header your ingress sets (`TRUSTED_IP_HEADER`), never a client-supplied `X-Forwarded-For` hop.
- **Audit trail** for sign-ins, every create/update/delete (with before → after values), role changes, exports and imports, including IP address and user agent.
- **Dev sign-in** (email + password for seeded personas) only works when `NODE_ENV !== "production"` **and** `AUTH_DEV_LOGIN=true`.

---

## Getting started (local)

Requirements: Node 24+, Docker.

```bash
npm install
```

```bash
cp .env.example .env
```

Set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_DEV_PASSWORD` in `.env`, then start the database, migrate and seed it:

```bash
npm run db:up
```

```bash
npx prisma migrate dev
```

```bash
npm run db:seed
```

```bash
npm run dev -- -p 3100
```

Open http://localhost:3100. Without Entra configured, sign in with a seeded persona using the password from `AUTH_DEV_PASSWORD`: `admin@pwc.com` (Admin), or the employees `rana.zaki@pwc.com` and `farida.lotfy@pwc.com`.

The seed mirrors your spreadsheet's projects, clients and lines of service, with **fictional people**. Use **Admin → Import spreadsheet** to bring in the real workbook. Upload it as it is, or start from **Download template** on that page. The template has the expected columns, dropdowns built from the portal's reference data, and an instructions sheet.

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (fiscal year, utilization maths, auth policy, spreadsheet import) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |

---

## Configure Microsoft Entra ID (PwC tenant)

This is done by whoever administers app registrations in the PwC tenant, normally through an Identity / IAM request.

1. **App registration** → *New registration* → "Utilization Portal", *Accounts in this organizational directory only* (single tenant).
2. **Redirect URI** (Web): `https://<your-host>/api/auth/callback/microsoft`. Locally that's `http://localhost:3100/api/auth/callback/microsoft`.
3. **Certificates & secrets**: create a client secret and store it in Key Vault. (Better Auth also supports `private_key_jwt` / workload identity federation through `clientAssertion` if secrets aren't allowed.)
4. **Token configuration**: add the optional claims `email` and `upn` to the ID token.
5. **App roles**: create `Portal.Admin` and `Portal.User` (allowed member types: Users/Groups).
6. **Enterprise application** → *Properties* → **Assignment required = Yes**. Then assign security groups to the roles under *Users and groups*.
7. Set `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` and `TRUSTED_IP_HEADER`, and turn off `AUTH_DEV_LOGIN`.

Optionally set `AUTH_BOOTSTRAP_ADMINS` to give the first administrators the Admin role before Entra app roles are in place.

---

## Deploying to Azure

- **App:** Azure Container Apps or App Service for Containers using the included `Dockerfile` (standalone output, non-root user, `/api/health` probe).
- **Database:** Azure Database for PostgreSQL Flexible Server with private networking, TLS required, and automated backups or PITR. Run migrations once per release (`docker build --target migrate`, or `npm run db:deploy`).
- **Secrets:** Key Vault references for `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ENTRA_CLIENT_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Use the same key on every instance.
- **Network:** behind Front Door or Application Gateway with WAF; restrict to the corporate network if policy requires it.
- `BETTER_AUTH_URL` must be the public HTTPS origin.

CI (`.github/workflows/ci.yml`) runs migrations, lint, typecheck, tests, build and a production dependency audit on every PR.

---

## Brand assets: replace before go-live

- **Logo:** `src/components/brand/logo.tsx` holds a placeholder lockup. Replace it with the official PwC logo SVG from the PwC brand site, keeping the same component.
- **Typeface:** the stack starts with `PwC Helvetica Neue`, which is used automatically on machines where it's installed. To self-host it, add the licensed `.woff2` files under `public/fonts` and an `@font-face` in `globals.css`.

---

## Project structure

```
prisma/              schema, migrations, development seed
src/proxy.ts         CSP nonce + optimistic auth redirect
src/lib/
  auth.ts            Better Auth (Entra ID, sessions, hooks, rate limits)
  auth-policy.ts     pure role/domain rules (unit tested)
  session.ts         Data Access Layer: getCurrentUser / requireRole
  audit.ts           audit writer + field diff
  domain/            fiscal year + utilization maths (unit tested)
  import/            spreadsheet planner (pure, unit tested) + workbook reader
  queries/           read models for pages
src/app/
  sign-in/           email-first sign-in (Appkit 4 login layout)
  (portal)/          dashboard, projects, people, utilization, risks, search, admin
  api/               auth handler, Excel export, health probe
src/components/      Appkit-styled UI kit, app shell, charts
tests/               Vitest suites
```
