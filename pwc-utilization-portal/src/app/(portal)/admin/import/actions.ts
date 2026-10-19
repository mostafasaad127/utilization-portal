"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";
import { planImport, type ImportIssue } from "@/lib/import/plan";
import { ImportFileError, readWorkbook } from "@/lib/import/workbook";

export type ImportResult = {
  mode?: "preview" | "commit";
  error?: string;
  summary?: {
    sheets: string[];
    rowsRead: number;
    projects: number;
    newProjects: number;
    duplicates: number;
    assignments: number;
    risks: number;
    newClients: string[];
    newPeople: string[];
    newLinesOfService: string[];
    newIndustries: string[];
    newCapabilities: string[];
  };
  issues?: ImportIssue[];
  preview?: { name: string; client: string; status: string; team: string; duplicate: boolean }[];
};

/**
 * Two-step import. "preview" parses and validates without writing anything;
 * "commit" re-parses the same file and writes everything in one transaction.
 * Projects that already exist (same name, client and start date) are skipped,
 * so re-importing the same workbook is safe.
 */
export async function importSpreadsheet(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const admin = await requireRole("ADMIN");
  const mode = formData.get("mode") === "commit" ? "commit" : "preview";
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to import." };

  let sheets;
  try {
    sheets = await readWorkbook(file);
  } catch (e) {
    return { error: e instanceof ImportFileError ? e.message : "The workbook couldn't be read." };
  }

  const plan = planImport(sheets);
  const errors = plan.issues.filter((i) => i.level === "error");

  const [territories, clients, people, los, industries, capabilities, existing] = await Promise.all([
    db.territory.findMany(),
    db.client.findMany({ select: { id: true, name: true } }),
    db.person.findMany({ select: { id: true, name: true } }),
    db.lineOfService.findMany({ select: { id: true, name: true } }),
    db.industry.findMany({ select: { id: true, name: true } }),
    db.capability.findMany({ select: { id: true, code: true } }),
    db.project.findMany({ where: { deletedAt: null }, select: { name: true, startDate: true, client: { select: { name: true } } } }),
  ]);
  const key = (s: string) => s.trim().toLowerCase();
  const territoryByCode = new Map(territories.map((t) => [t.code.toUpperCase(), t.id]));
  const existingKeys = new Set(existing.map((p) => `${key(p.name)}|${key(p.client.name)}|${p.startDate.toISOString().slice(0, 10)}`));

  // Territory must already exist — it is structural, not free text.
  const unknownTerritories = new Set(plan.projects.filter((p) => !territoryByCode.has(p.territory)).map((p) => p.territory));
  for (const t of unknownTerritories) {
    errors.push({ sheet: "-", row: 0, level: "error", message: `Territory “${t}” doesn't exist. Add it before importing.` });
  }

  const isDup = (p: (typeof plan.projects)[number]) => existingKeys.has(`${key(p.name)}|${key(p.client)}|${p.startDate.toISOString().slice(0, 10)}`);
  const toCreate = plan.projects.filter((p) => !isDup(p) && territoryByCode.has(p.territory));

  const missing = <T,>(values: (string | null)[], have: T[], getName: (t: T) => string) => {
    const known = new Set(have.map((h) => key(getName(h))));
    return Array.from(new Set(values.filter((v): v is string => Boolean(v)).filter((v) => !known.has(key(v)))));
  };
  const newClients = missing(toCreate.map((p) => p.client), clients, (c) => c.name);
  const newPeople = missing(toCreate.flatMap((p) => p.assignments.map((a) => a.person)), people, (p) => p.name);
  const newLos = missing(toCreate.map((p) => p.lineOfService), los, (l) => l.name);
  const newIndustries = missing(toCreate.map((p) => p.industry), industries, (i) => i.name);
  const newCaps = missing(toCreate.flatMap((p) => p.assignments.map((a) => a.capability)), capabilities, (c) => c.code);

  const summary = {
    sheets: plan.sheetsRead,
    rowsRead: plan.rowsRead,
    projects: plan.projects.length,
    newProjects: toCreate.length,
    duplicates: plan.projects.filter(isDup).length,
    assignments: toCreate.reduce((s, p) => s + p.assignments.length, 0),
    risks: toCreate.reduce((s, p) => s + p.risks.length, 0),
    newClients,
    newPeople,
    newLinesOfService: newLos,
    newIndustries,
    newCapabilities: newCaps,
  };
  const issues = [...errors, ...plan.issues.filter((i) => i.level === "warning")].slice(0, 300);
  const preview = plan.projects.slice(0, 200).map((p) => ({
    name: p.name,
    client: p.client,
    status: p.status,
    team: p.assignments.map((a) => `${a.person} (${a.allocation}%)`).join(", "),
    duplicate: isDup(p),
  }));

  if (mode === "preview" || errors.length > 0) {
    return { mode: "preview", summary, issues, preview, ...(mode === "commit" && errors.length ? { error: "Fix the errors before importing." } : {}) };
  }

  try {
    await db.$transaction(
      async (tx) => {
        const ids = {
          client: new Map(clients.map((c) => [key(c.name), c.id])),
          person: new Map(people.map((p) => [key(p.name), p.id])),
          los: new Map(los.map((l) => [key(l.name), l.id])),
          industry: new Map(industries.map((i) => [key(i.name), i.id])),
          capability: new Map(capabilities.map((c) => [key(c.code), c.id])),
        };
        for (const name of newIndustries) ids.industry.set(key(name), (await tx.industry.create({ data: { name } })).id);
        for (const code of newCaps) ids.capability.set(key(code), (await tx.capability.create({ data: { code, name: code } })).id);
        for (const name of newPeople) ids.person.set(key(name), (await tx.person.create({ data: { name } })).id);
        for (const name of newLos) {
          const territory = toCreate.find((p) => p.lineOfService === name)!.territory;
          ids.los.set(key(name), (await tx.lineOfService.create({ data: { name, territoryId: territoryByCode.get(territory)! } })).id);
        }
        for (const name of newClients) {
          const industry = toCreate.find((p) => p.client === name)?.industry;
          ids.client.set(key(name), (await tx.client.create({ data: { name, industryId: industry ? ids.industry.get(key(industry)) : undefined } })).id);
        }

        for (const p of toCreate) {
          await tx.project.create({
            data: {
              name: p.name,
              clientId: ids.client.get(key(p.client))!,
              industryId: p.industry ? ids.industry.get(key(p.industry)) : undefined,
              lineOfServiceId: p.lineOfService ? ids.los.get(key(p.lineOfService)) : undefined,
              territoryId: territoryByCode.get(p.territory)!,
              status: p.status,
              rag: p.rag,
              startDate: p.startDate,
              endDate: p.endDate,
              multiTower: p.multiTower,
              engagementLeads: p.engagementLeads,
              scope: p.scope,
              createdById: admin.id,
              updatedById: admin.id,
              assignments: {
                create: p.assignments.map((a) => ({
                  personId: ids.person.get(key(a.person))!,
                  capabilityId: a.capability ? ids.capability.get(key(a.capability)) : undefined,
                  allocation: a.allocation,
                  startDate: p.startDate,
                  endDate: p.endDate,
                })),
              },
              risks: {
                create: p.risks.map((title) => ({
                  title: title.slice(0, 500),
                  severity: "MEDIUM" as const,
                  status: p.status === "CLOSED" ? ("CLOSED" as const) : ("OPEN" as const),
                  createdById: admin.id,
                })),
              },
            },
          });
        }

        await audit(tx, admin, {
          action: "import.spreadsheet",
          entityType: "system",
          summary: `Imported ${toCreate.length} projects from “${file.name.slice(0, 120)}”`,
          changes: { ...summary, file: file.name.slice(0, 200) } as never,
        });
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    console.error("import failed", e);
    return { mode: "preview", summary, issues, preview, error: "The import failed and nothing was saved. Please try again." };
  }

  revalidatePath("/", "layout");
  return { mode: "commit", summary, issues };
}
