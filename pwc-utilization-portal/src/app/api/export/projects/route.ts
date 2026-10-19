import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser, requestMeta } from "@/lib/session";
import { exportProjects, parseProjectFilters } from "@/lib/queries/projects";
import { RAG_LABEL, STATUS_LABEL } from "@/lib/labels";
import { projectRef } from "@/lib/utils";

/**
 * Exports the filtered project list as .xlsx using the same columns as the
 * legacy utilization spreadsheet, so downstream consumers keep working.
 * Authenticated in the handler itself (the proxy does not run on /api).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseProjectFilters(params);
  const projects = await exportProjects(filters, user); // employees export only their own projects

  const wb = new ExcelJS.Workbook();
  wb.creator = "Utilization Portal";
  wb.created = new Date();
  const ws = wb.addWorksheet("Projects", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "Ref", key: "ref", width: 11 },
    { header: "Project Name", key: "name", width: 44 },
    { header: "Capability", key: "capability", width: 12 },
    { header: "Status", key: "status", width: 11 },
    { header: "RAG", key: "rag", width: 9 },
    { header: "Start_Date", key: "start", width: 14, style: { numFmt: "dd mmmm yyyy" } },
    { header: "End_Date", key: "end", width: 14, style: { numFmt: "dd mmmm yyyy" } },
    { header: "Territory", key: "territory", width: 10 },
    { header: "Client", key: "client", width: 32 },
    { header: "Multi Tower", key: "multiTower", width: 12 },
    { header: "Team Resources", key: "team", width: 32 },
    { header: "Industry", key: "industry", width: 20 },
    { header: "LoS", key: "los", width: 18 },
    { header: "Engagement Lead/Partner", key: "leads", width: 30 },
    { header: "Team Utilization %", key: "utilization", width: 18 },
    { header: "Project Scope", key: "scope", width: 60 },
    { header: "Risks/Challenges", key: "risks", width: 60 },
  ];

  for (const p of projects) {
    ws.addRow({
      ref: projectRef(p.number),
      name: p.name,
      capability: Array.from(new Set(p.assignments.map((a) => a.capability?.code).filter(Boolean))).join(","),
      status: STATUS_LABEL[p.status],
      rag: RAG_LABEL[p.rag],
      start: p.startDate,
      end: p.endDate ?? "TBD",
      territory: p.territory.code,
      client: p.client.name,
      multiTower: p.multiTower ? "Yes" : "No",
      team: p.assignments.map((a) => a.person.name).join(", "),
      industry: p.industry?.name ?? "",
      los: p.lineOfService?.name ?? "",
      leads: p.engagementLeads.join(", "),
      // Employees see teammates' names but only their own allocation.
      utilization: p.assignments
        .filter((a) => user.role === "ADMIN" || a.personId === user.personId)
        .map((a) => `${a.allocation}%`)
        .join(", "),
      scope: p.scope ?? "",
      risks: p.risks.map((r) => `- ${r.title}`).join("\n"),
    });
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D2D2D" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  ws.eachRow((row, i) => {
    if (i > 1) row.alignment = { vertical: "top", wrapText: true };
  });

  const meta = await requestMeta();
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "project.export",
      entityType: "project",
      summary: `Exported ${projects.length} projects to Excel`,
      changes: { filters: params },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="projects-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
