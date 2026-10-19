"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";
import { fieldErrors, type FormState } from "@/lib/validation";
import { hashPassword } from "better-auth/crypto";
import { env } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth-policy";

// ── Users & roles ───────────────────────────────────────────────────────────

const roleSchema = z.enum(["ADMIN", "EMPLOYEE"]);
const optId = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().cuid().optional());


export async function setUserRole(userId: string, role: string): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { error: "Unknown role." };
  if (userId === admin.id) return { error: "You can't change your own role." };
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };
  if (target.role === parsed.data) return { ok: true };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: parsed.data } });
    await audit(tx, admin, {
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      summary: `Changed ${target.email} from ${target.role} to ${parsed.data}`,
      changes: { role: { from: target.role, to: parsed.data } },
    });
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) return { error: "You can't deactivate your own account." };
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive } });
    // Deactivation revokes every live session immediately.
    if (!isActive) await tx.session.deleteMany({ where: { userId } });
    await audit(tx, admin, {
      action: isActive ? "user.activate" : "user.deactivate",
      entityType: "user",
      entityId: userId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} ${target.email}`,
    });
  });
  revalidatePath("/admin/users");
  return { ok: true, message: isActive ? "Access restored." : "Access revoked and sessions signed out." };
}

export async function revokeSessions(userId: string): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found." };
  const { count } = await db.session.deleteMany({ where: { userId } });
  await audit(db, admin, { action: "user.sessions_revoke", entityType: "user", entityId: userId, summary: `Signed out ${count} session(s) for ${target.email}` });
  revalidatePath("/admin/users");
  return { ok: true, message: `Signed out ${count} session${count === 1 ? "" : "s"}.` };
}

// ── Add users (invitations) ─────────────────────────────────────────────────

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter their full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  role: roleSchema,
  grade: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["ASSOCIATE", "SENIOR_ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "PARTNER"]).optional(),
  ),
  territoryId: optId,
  primaryCapabilityId: optId,
});

/**
 * Adds someone to the portal before their first sign-in. Creates (or updates)
 * an invitation carrying their role, and their resource record so they can be
 * staffed right away. Their login is created by SSO on first sign-in.
 * In local development (no SSO) the login is provisioned immediately with the
 * dev password so the account can be tried out.
 */
export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!isAllowedEmail(d.email, env.allowedDomains)) {
    return { fieldErrors: { email: `Only ${env.allowedDomains.map((x) => `@${x}`).join(", ")} addresses can be added.` } };
  }
  const existingUser = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (existingUser) return { fieldErrors: { email: "This person already has access. Change their role in the list below." } };

  try {
    await db.$transaction(async (tx) => {
      await tx.invitation.upsert({
        where: { email: d.email },
        create: { email: d.email, name: d.name, role: d.role, invitedById: admin.id },
        update: { name: d.name, role: d.role, invitedById: admin.id, revokedAt: null, acceptedAt: null },
      });
      const person = await tx.person.findUnique({ where: { email: d.email }, select: { id: true } });
      const details = {
        name: d.name,
        grade: d.grade ?? null,
        territoryId: d.territoryId ?? null,
        primaryCapabilityId: d.primaryCapabilityId ?? null,
        isActive: true,
      };
      if (person) await tx.person.update({ where: { id: person.id }, data: details });
      else await tx.person.create({ data: { ...details, email: d.email } });

      if (env.devLoginEnabled && env.AUTH_DEV_PASSWORD.length >= 12) {
        const user = await tx.user.create({ data: { email: d.email, name: d.name, role: d.role, emailVerified: true } });
        await tx.account.create({ data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(env.AUTH_DEV_PASSWORD) } });
        await tx.person.update({ where: { email: d.email }, data: { userId: user.id } });
        await tx.invitation.update({ where: { email: d.email }, data: { acceptedAt: new Date() } });
      }
      await audit(tx, admin, {
        action: "user.invite",
        entityType: "user",
        summary: `Added ${d.email} as ${d.role}`,
        changes: { email: d.email, role: d.role } as never,
      });
    });
  } catch (e) {
    console.error("inviteUser failed", e);
    return { error: "Couldn't add this user. Please try again." };
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/reference");
  return {
    ok: true,
    message: env.devLoginEnabled
      ? `${d.name} can now sign in (local dev: with the AUTH_DEV_PASSWORD).`
      : `${d.name} has been added. They'll get the ${d.role === "ADMIN" ? "Admin" : "Employee"} role when they first sign in with PwC SSO.`,
  };
}

export async function revokeInvitation(invitationId: string): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const invite = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!invite || invite.acceptedAt || invite.revokedAt) return { error: "This invitation is no longer pending." };
  await db.$transaction(async (tx) => {
    await tx.invitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
    await audit(tx, admin, { action: "user.invite_revoke", entityType: "user", summary: `Revoked invitation for ${invite.email}` });
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "Invitation revoked." };
}

// ── Reference data ──────────────────────────────────────────────────────────

const name = z.string().trim().min(1, "Required").max(200);

const KINDS = {
  client: z.object({ name, industryId: optId }),
  industry: z.object({ name }),
  lineOfService: z.object({ name, territoryId: z.string().cuid("Choose a territory") }),
  capability: z.object({ code: z.string().trim().min(1).max(10), name }),
} as const;
type Kind = keyof typeof KINDS;

export async function createReference(kind: Kind, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const schema = KINDS[kind];
  if (!schema) return { error: "Unknown type." };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data = parsed.data as Record<string, string | undefined>;

  try {
    await db.$transaction(async (tx) => {
      let id: string;
      if (kind === "client") id = (await tx.client.create({ data: { name: data.name!, industryId: data.industryId } })).id;
      else if (kind === "industry") id = (await tx.industry.create({ data: { name: data.name! } })).id;
      else if (kind === "lineOfService") id = (await tx.lineOfService.create({ data: { name: data.name!, territoryId: data.territoryId! } })).id;
      else id = (await tx.capability.create({ data: { code: data.code!, name: data.name! } })).id;
      await audit(tx, admin, { action: `${kind}.create`, entityType: kind, entityId: id, summary: `Added ${kind} “${data.name}”` });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "An entry with that name already exists." };
    console.error("createReference failed", e);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath("/admin/reference");
  return { ok: true, message: "Added." };
}

export async function toggleReference(kind: Kind, id: string, isActive: boolean): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const args = { where: { id }, data: { isActive } };
  if (kind === "client") await db.client.update(args);
  else if (kind === "industry") await db.industry.update(args);
  else if (kind === "lineOfService") await db.lineOfService.update(args);
  else if (kind === "capability") await db.capability.update(args);
  else return { error: "Unknown type." };
  await audit(db, admin, { action: `${kind}.${isActive ? "activate" : "archive"}`, entityType: kind, entityId: id, summary: `${isActive ? "Restored" : "Archived"} ${kind}` });
  revalidatePath("/admin/reference");
  return { ok: true };
}

// ── Resource pool (people) ──────────────────────────────────────────────────

const personSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().email("Enter a valid email").max(254).optional()),
  grade: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["ASSOCIATE", "SENIOR_ASSOCIATE", "MANAGER", "SENIOR_MANAGER", "DIRECTOR", "PARTNER"]).optional()),
  territoryId: optId,
  primaryCapabilityId: optId,
});

export async function savePerson(personId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = personSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data = {
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    grade: parsed.data.grade ?? null,
    territoryId: parsed.data.territoryId ?? null,
    primaryCapabilityId: parsed.data.primaryCapabilityId ?? null,
  };
  try {
    await db.$transaction(async (tx) => {
      // Link to an existing portal login with the same email, if any.
      const user = data.email ? await tx.user.findUnique({ where: { email: data.email }, select: { id: true, person: { select: { id: true } } } }) : null;
      const userId = user && (!user.person || user.person.id === personId) ? user.id : undefined;
      if (personId) {
        await tx.person.update({ where: { id: personId }, data: { ...data, ...(userId ? { userId } : {}) } });
        await audit(tx, admin, { action: "person.update", entityType: "person", entityId: personId, summary: `Updated ${data.name}` });
      } else {
        const p = await tx.person.create({ data: { ...data, userId } });
        await audit(tx, admin, { action: "person.create", entityType: "person", entityId: p.id, summary: `Added ${data.name} to the resource pool` });
      }
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { fieldErrors: { email: "Another person already uses this email." } };
    console.error("savePerson failed", e);
    return { error: "Couldn't save. Please try again." };
  }
  revalidatePath("/admin/reference");
  revalidatePath("/people");
  return { ok: true, message: personId ? "Person updated." : "Person added." };
}

export async function setPersonActive(personId: string, isActive: boolean): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const p = await db.person.update({ where: { id: personId }, data: { isActive } });
  await audit(db, admin, { action: isActive ? "person.activate" : "person.archive", entityType: "person", entityId: personId, summary: `${isActive ? "Restored" : "Archived"} ${p.name}` });
  revalidatePath("/admin/reference");
  revalidatePath("/people");
  return { ok: true };
}
