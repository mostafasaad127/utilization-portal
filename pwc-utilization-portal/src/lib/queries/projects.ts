import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { fiscalYearOf, parseFiscalYear } from "@/lib/domain/fiscal-year";
import { projectScope } from "@/lib/access";
import type { CurrentUser } from "@/lib/session";

export const PAGE_SIZE = 25;

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const opt = z.preprocess((v) => (one(v) === "" ? undefined : one(v)), z.string().max(200).optional());

export const projectFilterSchema = z.object({
  q: opt,
  status: z.preprocess(one, z.enum(["PIPELINE", "ACTIVE", "ON_HOLD", "CLOSED", "OPEN"]).optional().catch(undefined)),
  rag: z.preprocess(one, z.enum(["GREEN", "AMBER", "RED"]).optional().catch(undefined)),
  territory: opt,
  los: opt,
  capability: opt,
  client: opt,
  fy: opt, // "FY27" or "all"; defaults to the current fiscal year
  sort: z.preprocess(one, z.enum(["name", "client", "start", "end", "status", "rag", "number"]).catch("start")),
  dir: z.preprocess(one, z.enum(["asc", "desc"]).catch("desc")),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(10_000).catch(1)),
});

export type ProjectFilters = z.infer<typeof projectFilterSchema>;

export function parseProjectFilters(params: Record<string, string | string[] | undefined>): ProjectFilters {
  return projectFilterSchema.parse(params);
}

export function buildProjectWhere(f: ProjectFilters, user: CurrentUser): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [{ deletedAt: null }, projectScope(user)];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { client: { name: { contains: f.q, mode: "insensitive" } } },
        { engagementLeads: { has: f.q } },
        // Searching by teammate name is an admin capability.
        ...(user.role === "ADMIN" ? [{ assignments: { some: { person: { name: { contains: f.q, mode: "insensitive" as const } } } } }] : []),
      ],
    });
  }
  if (f.status === "OPEN") and.push({ status: { in: ["ACTIVE", "ON_HOLD", "PIPELINE"] } });
  else if (f.status) and.push({ status: f.status });
  if (f.rag) and.push({ rag: f.rag });
  if (f.territory) and.push({ territory: { code: f.territory } });
  if (f.los) and.push({ lineOfServiceId: f.los });
  if (f.client) and.push({ clientId: f.client });
  if (f.capability) and.push({ assignments: { some: { capability: { code: f.capability } } } });

  const fy = f.fy === "all" ? null : (parseFiscalYear(f.fy) ?? fiscalYearOf(new Date()));
  if (fy) {
    and.push({ startDate: { lte: fy.end } });
    and.push({ OR: [{ endDate: null }, { endDate: { gte: fy.start } }] });
  }
  return { AND: and };
}

function orderBy(f: ProjectFilters): Prisma.ProjectOrderByWithRelationInput[] {
  const dir = f.dir;
  switch (f.sort) {
    case "name":
      return [{ name: dir }];
    case "client":
      return [{ client: { name: dir } }, { name: "asc" }];
    case "end":
      return [{ endDate: { sort: dir, nulls: "last" } }, { name: "asc" }];
    case "status":
      return [{ status: dir }, { name: "asc" }];
    case "rag":
      return [{ rag: dir }, { name: "asc" }];
    case "number":
      return [{ number: dir }];
    default:
      return [{ startDate: dir }, { name: "asc" }];
  }
}

export const projectListSelect = {
  id: true,
  number: true,
  name: true,
  status: true,
  rag: true,
  startDate: true,
  endDate: true,
  multiTower: true,
  engagementLeads: true,
  client: { select: { name: true } },
  territory: { select: { code: true } },
  lineOfService: { select: { name: true } },
  industry: { select: { name: true } },
  assignments: {
    select: { allocation: true, personId: true, person: { select: { id: true, name: true } }, capability: { select: { code: true } } },
    orderBy: { allocation: "desc" },
  },
  _count: { select: { risks: { where: { status: { not: "CLOSED" } } } } },
} satisfies Prisma.ProjectSelect;

export async function listProjects(f: ProjectFilters, user: CurrentUser) {
  const where = buildProjectWhere(f, user);
  const [total, rows] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy: orderBy(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: projectListSelect,
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Unpaginated, for Excel export (capped as a safety limit). */
export async function exportProjects(f: ProjectFilters, user: CurrentUser) {
  return db.project.findMany({
    where: buildProjectWhere(f, user),
    orderBy: orderBy(f),
    take: 5000,
    select: { ...projectListSelect, scope: true, risks: { where: { status: { not: "CLOSED" } }, select: { title: true } } },
  });
}

/** Loads a project the user may access; null (→ 404) otherwise, so existence isn't revealed. */
export async function getProject(id: string, user: CurrentUser) {
  return db.project.findFirst({
    where: { id, deletedAt: null, ...projectScope(user) },
    include: {
      client: true,
      territory: true,
      lineOfService: true,
      industry: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      assignments: {
        include: { person: { select: { id: true, name: true, grade: true } }, capability: true },
        orderBy: [{ startDate: "asc" }, { allocation: "desc" }],
      },
      risks: { orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }] },
      updates: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;
