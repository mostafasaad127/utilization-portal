"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { requireRole, requireUser, type CurrentUser } from "@/lib/session";
import { canWorkOnProject, isAdmin, myPersonId } from "@/lib/access";
import type { Prisma } from "@/generated/prisma/client";
import {
  assignmentSchema,
  fieldErrors,
  involvementSchema,
  projectSchema,
  riskSchema,
  updateSchema,
  type FormState,
} from "@/lib/validation";

/*
 * Authorisation summary (enforced here, not just in the UI):
 *  - Any signed-in user can create a project. An employee is always added to
 *    the team of a project they create.
 *  - Editing a project, its risks and status updates: admins, or employees
 *    assigned to that project.
 *  - Assignments: admins manage anyone's; employees only their own (they can
 *    join any live project by adding their own assignment).
 *  - Deleting a project: admins only. Deleting a risk: admins or its author.
 */

const GENERIC_ERROR = "Something went wrong saving your changes. Please try again.";
const NO_ACCESS = "You don't have access to this project.";

function formObject(formData: FormData) {
  return Object.fromEntries(Array.from(formData.keys()).map((k) => [k, formData.get(k)]));
}

/** Runs inside the caller's transaction so a failed save never leaves an orphan client. */
async function resolveClientId(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  clientId: string | undefined,
  newClientName: string | undefined,
  industryId: string | undefined,
) {
  if (clientId) return clientId;
  const name = newClientName!.trim();
  const existing = await tx.client.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return existing.id;
  const created = await tx.client.create({ data: { name, industryId } });
  await audit(tx, user, { action: "client.create", entityType: "client", entityId: created.id, summary: `Added client “${name}”` });
  return created.id;
}

function refresh(projectId?: string) {
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/projects/join");
  revalidatePath("/risks");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const form = formObject(formData);
  const parsed = projectSchema.safeParse(form);
  // Employees always join the project they log; admins opt in.
  const joining = !isAdmin(user) || form.imOnProject === "on";
  const involvement = joining ? involvementSchema.safeParse(form) : null;
  if (!parsed.success || (involvement && !involvement.success)) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrors(parsed.error)),
        ...(involvement && !involvement.success ? fieldErrors(involvement.error) : {}),
      },
    };
  }
  const { newClientName, clientId, ...data } = parsed.data;

  let id: string;
  try {
    const personId = joining ? await myPersonId(user) : null;
    id = await db.$transaction(async (tx) => {
      const resolvedClientId = await resolveClientId(tx, user, clientId, newClientName, data.industryId);
      const project = await tx.project.create({
        data: { ...data, endDate: data.endDate ?? null, clientId: resolvedClientId, createdById: user.id, updatedById: user.id },
      });
      if (personId && involvement?.success) {
        await tx.assignment.create({
          data: {
            projectId: project.id,
            personId,
            allocation: involvement.data.myAllocation,
            capabilityId: involvement.data.myCapabilityId ?? null,
            startDate: project.startDate,
            endDate: project.endDate,
          },
        });
      }
      await audit(tx, user, {
        action: "project.create",
        entityType: "project",
        entityId: project.id,
        summary: `Created project “${project.name}”${personId && involvement?.success ? ` and joined at ${involvement.data.myAllocation}%` : ""}`,
      });
      return project.id;
    });
  } catch (e) {
    console.error("createProject failed", e);
    return { error: GENERIC_ERROR };
  }
  refresh();
  redirect(`/projects/${id}?created=1`);
}

export async function updateProject(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await canWorkOnProject(user, projectId))) return { error: NO_ACCESS };
  const parsed = projectSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { newClientName, clientId, ...data } = parsed.data;

  try {
    const before = await db.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!before) return { error: "This project no longer exists." };
    await db.$transaction(async (tx) => {
      const resolvedClientId = await resolveClientId(tx, user, clientId, newClientName, data.industryId);
      const next = { ...data, endDate: data.endDate ?? null, clientId: resolvedClientId };
      const changes = diff(before as unknown as Record<string, unknown>, next);
      await tx.project.update({ where: { id: projectId }, data: { ...next, updatedById: user.id } });
      if (Object.keys(changes).length > 0) {
        await audit(tx, user, {
          action: "project.update",
          entityType: "project",
          entityId: projectId,
          summary: `Updated ${Object.keys(changes).join(", ")}`,
          changes: changes as never,
        });
      }
    });
  } catch (e) {
    console.error("updateProject failed", e);
    return { error: GENERIC_ERROR };
  }
  refresh(projectId);
  redirect(`/projects/${projectId}?saved=1`);
}

export async function deleteProject(projectId: string): Promise<void> {
  const user = await requireRole("ADMIN");
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) redirect("/projects");
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { deletedAt: new Date(), updatedById: user.id } });
    await audit(tx, user, { action: "project.delete", entityType: "project", entityId: projectId, summary: `Deleted project “${project.name}”` });
  });
  refresh();
  redirect("/projects?deleted=1");
}

// ── Assignments ─────────────────────────────────────────────────────────────

export async function saveAssignment(projectId: string, assignmentId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const admin = isAdmin(user);
  const form = formObject(formData);
  // Employees can only ever book themselves; any personId they send is ignored.
  const selfId = admin ? null : await myPersonId(user);
  const parsed = assignmentSchema.safeParse(admin ? form : { ...form, personId: selfId });
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data = { ...parsed.data, endDate: parsed.data.endDate ?? null, note: parsed.data.note ?? null, capabilityId: parsed.data.capabilityId ?? null };

  try {
    const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { name: true } });
    if (!project) return { error: "This project no longer exists." };
    const person = await db.person.findUnique({ where: { id: data.personId }, select: { name: true } });
    if (!person) return { fieldErrors: { personId: "Choose a person" } };

    await db.$transaction(async (tx) => {
      if (assignmentId) {
        const before = await tx.assignment.findFirst({ where: { id: assignmentId, projectId, ...(admin ? {} : { personId: selfId! }) } });
        if (!before) throw new AccessError();
        await tx.assignment.update({ where: { id: assignmentId }, data });
        await audit(tx, user, {
          action: "assignment.update",
          entityType: "project",
          entityId: projectId,
          summary: `Updated ${person.name}'s assignment`,
          changes: diff(before as unknown as Record<string, unknown>, data) as never,
        });
      } else {
        await tx.assignment.create({ data: { ...data, projectId } });
        await audit(tx, user, {
          action: admin ? "assignment.create" : "assignment.join",
          entityType: "project",
          entityId: projectId,
          summary: admin ? `Assigned ${person.name} at ${data.allocation}%` : `${person.name} joined at ${data.allocation}%`,
        });
      }
    });
  } catch (e) {
    if (e instanceof AccessError) return { error: NO_ACCESS };
    console.error("saveAssignment failed", e);
    return { error: GENERIC_ERROR };
  }
  refresh(projectId);
  revalidatePath(`/people/${data.personId}`);
  return { ok: true, message: assignmentId ? "Assignment updated." : admin ? "Team member added." : "You've been added to the project." };
}

export async function removeAssignment(projectId: string, assignmentId: string): Promise<FormState> {
  const user = await requireUser();
  const admin = isAdmin(user);
  const selfId = admin ? null : await myPersonId(user);
  const a = await db.assignment.findFirst({
    where: { id: assignmentId, projectId, project: { deletedAt: null }, ...(admin ? {} : { personId: selfId! }) },
    include: { person: { select: { name: true } } },
  });
  if (!a) return { error: NO_ACCESS };
  await db.$transaction(async (tx) => {
    await tx.assignment.delete({ where: { id: assignmentId } });
    await audit(tx, user, { action: "assignment.delete", entityType: "project", entityId: projectId, summary: `Removed ${a.person.name} from the team` });
  });
  refresh(projectId);
  return { ok: true, message: "Removed from the team." };
}

// ── Risks ───────────────────────────────────────────────────────────────────

export async function saveRisk(projectId: string, riskId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await canWorkOnProject(user, projectId))) return { error: NO_ACCESS };
  const parsed = riskSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const data = { ...parsed.data, mitigation: parsed.data.mitigation ?? null, owner: parsed.data.owner ?? null };

  try {
    await db.$transaction(async (tx) => {
      if (riskId) {
        const before = await tx.risk.findFirst({ where: { id: riskId, projectId } });
        if (!before) throw new AccessError();
        await tx.risk.update({ where: { id: riskId }, data });
        await audit(tx, user, {
          action: "risk.update",
          entityType: "project",
          entityId: projectId,
          summary: `Updated risk “${data.title.slice(0, 80)}”`,
          changes: diff(before as unknown as Record<string, unknown>, data) as never,
        });
      } else {
        await tx.risk.create({ data: { ...data, projectId, createdById: user.id } });
        await audit(tx, user, { action: "risk.create", entityType: "project", entityId: projectId, summary: `Raised risk “${data.title.slice(0, 80)}”` });
      }
    });
  } catch (e) {
    if (e instanceof AccessError) return { error: "Risk not found." };
    console.error("saveRisk failed", e);
    return { error: GENERIC_ERROR };
  }
  refresh(projectId);
  return { ok: true, message: riskId ? "Risk updated." : "Risk added." };
}

export async function deleteRisk(projectId: string, riskId: string): Promise<FormState> {
  const user = await requireUser();
  if (!(await canWorkOnProject(user, projectId))) return { error: NO_ACCESS };
  const risk = await db.risk.findFirst({ where: { id: riskId, projectId } });
  if (!risk) return { error: "Risk not found." };
  if (!isAdmin(user) && risk.createdById !== user.id) return { error: "Only the person who raised this risk or an admin can delete it. You can close it instead." };
  await db.$transaction(async (tx) => {
    await tx.risk.delete({ where: { id: riskId } });
    await audit(tx, user, { action: "risk.delete", entityType: "project", entityId: projectId, summary: `Deleted risk “${risk.title.slice(0, 80)}”` });
  });
  refresh(projectId);
  return { ok: true, message: "Risk deleted." };
}

// ── Status updates ──────────────────────────────────────────────────────────

export async function postUpdate(projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await canWorkOnProject(user, projectId))) return { error: NO_ACCESS };
  const parsed = updateSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  try {
    const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { rag: true } });
    if (!project) return { error: "This project no longer exists." };
    await db.$transaction(async (tx) => {
      await tx.projectUpdate.create({ data: { projectId, authorId: user.id, ...parsed.data } });
      if (project.rag !== parsed.data.rag) {
        await tx.project.update({ where: { id: projectId }, data: { rag: parsed.data.rag, updatedById: user.id } });
      }
      await audit(tx, user, {
        action: "project.status_update",
        entityType: "project",
        entityId: projectId,
        summary: project.rag !== parsed.data.rag ? `Posted update and changed RAG to ${parsed.data.rag}` : "Posted a status update",
      });
    });
  } catch (e) {
    console.error("postUpdate failed", e);
    return { error: GENERIC_ERROR };
  }
  refresh(projectId);
  return { ok: true, message: "Update posted." };
}

class AccessError extends Error {}
