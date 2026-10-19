import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ensurePersonForUser } from "@/lib/people";
import type { CurrentUser } from "@/lib/session";

/**
 * Row-level access rules.
 *
 *  ADMIN     sees and edits everything.
 *  EMPLOYEE  sees and edits only projects they are assigned to, and only their
 *            own assignment within them. Teammates' allocation is never shown.
 *
 * Every query that lists or loads projects composes `projectScope(user)`, and
 * every mutation re-checks with `canWorkOnProject` — the UI hiding a button is
 * never the only protection.
 */
export function isAdmin(user: CurrentUser) {
  return user.role === "ADMIN";
}

export function projectScope(user: CurrentUser): Prisma.ProjectWhereInput {
  if (isAdmin(user)) return {};
  // An employee without a resource record has no projects yet.
  return user.personId ? { assignments: { some: { personId: user.personId } } } : { id: "__none__" };
}

export function riskScope(user: CurrentUser): Prisma.RiskWhereInput {
  return { project: { deletedAt: null, ...projectScope(user) } };
}

/** True when the user may view and edit this (non-deleted) project. */
export async function canWorkOnProject(user: CurrentUser, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null, ...projectScope(user) },
    select: { id: true },
  });
  return Boolean(project);
}

/** The signed-in user's resource record, created on first use. */
export async function myPersonId(user: CurrentUser) {
  return user.personId ?? ensurePersonForUser(user);
}
