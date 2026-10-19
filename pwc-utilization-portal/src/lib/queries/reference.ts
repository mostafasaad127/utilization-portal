import "server-only";
import { db } from "@/lib/db";

/** Reference data for filters and forms. */
export async function getReferenceData() {
  const [territories, capabilities, industries, linesOfService, clients, people] = await Promise.all([
    db.territory.findMany({ orderBy: { code: "asc" } }),
    db.capability.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.industry.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.lineOfService.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { territory: true } }),
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.person.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { territories, capabilities, industries, linesOfService, clients, people };
}

export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
