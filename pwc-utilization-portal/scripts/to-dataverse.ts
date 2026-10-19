/**
 * Converts the legacy utilization workbook into a load-ready workbook for the
 * Power Platform (Dataverse for Teams) version of the portal.
 *
 *   npm run dataverse:export -- "<legacy workbook>.xlsx" [output.xlsx]
 *
 * Reuses the portal's tested importer: rows for the same project (name, client,
 * start date) are merged, team members are split into assignments, and risks
 * are split one per line. Output sheets are numbered in load order. Reference
 * tables (1–6) can be pasted straight into the Dataverse table grid; the
 * staging sheets (7–9) are pasted into the "Import …" tables and turned into
 * real rows by the admin migration screen (see power-platform/05-migration.md).
 */
import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { planImport } from "../src/lib/import/plan";
import { readWorkbook } from "../src/lib/import/workbook";

const STATUS: Record<string, string> = { PIPELINE: "Pipeline", ACTIVE: "Active", ON_HOLD: "On hold", CLOSED: "Closed" };
const RAG: Record<string, string> = { GREEN: "Green", AMBER: "Amber", RED: "Red" };
const KNOWN_TERRITORIES: Record<string, string> = { UK: "United Kingdom", ME: "Middle East" };
const KNOWN_CAPABILITIES: Record<string, string> = {
  BA: "Business Analysis",
  PM: "Project Management",
  PDM: "Product Management",
  PO: "Product Ownership",
  SD: "Service Design",
  PD: "Product Design",
};

async function main() {
  const [input, outputArg] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: npm run dataverse:export -- "<legacy workbook>.xlsx" [output.xlsx]');
    process.exit(1);
  }
  const output = outputArg ?? path.join(path.dirname(input), "dataverse-import.xlsx");

  const bytes = await readFile(input);
  const plan = planImport(await readWorkbook(new File([bytes], path.basename(input))));
  const errors = plan.issues.filter((i) => i.level === "error");

  const key = (s: string) => s.trim().toLowerCase();
  const uniq = <T,>(items: T[], k: (t: T) => string) => Array.from(new Map(items.map((i) => [key(k(i)), i])).values());
  const date = (d: Date | null) => (d ? d : null);

  const projects = plan.projects;
  const territories = uniq(projects.map((p) => p.territory), (t) => t);
  const capabilities = uniq(projects.flatMap((p) => p.assignments.map((a) => a.capability).filter((c): c is string => Boolean(c))), (c) => c);
  const industries = uniq(projects.map((p) => p.industry).filter((i): i is string => Boolean(i)), (i) => i);
  const linesOfService = uniq(
    projects.filter((p) => p.lineOfService).map((p) => ({ name: p.lineOfService!, territory: p.territory })),
    (l) => l.name,
  );
  const clients = uniq(projects.map((p) => ({ name: p.client, industry: p.industry ?? "" })), (c) => c.name);
  const people = uniq(projects.flatMap((p) => p.assignments.map((a) => a.person)), (p) => p).sort((a, b) => a.localeCompare(b));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Utilization Portal → Dataverse export";
  const DARK = "FF2D2D2D";
  const ORANGE = "FFD04A02";

  const sheet = (name: string, columns: { header: string; key: string; width: number; date?: boolean }[], rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.date ? { numFmt: "dd/mm/yyyy" } : {} }));
    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    });
    rows.forEach((r) => ws.addRow(r));
    return ws;
  };

  // Read-me first so it opens on top.
  const readme = wb.addWorksheet("Read me", { properties: { tabColor: { argb: ORANGE } } });
  readme.getColumn(1).width = 110;
  [
    "Load order for the Teams (Dataverse for Teams) version of the Utilization Portal",
    "",
    "Sheets 1–6 are reference data: open the matching table in Power Apps (Teams → Build → See all → table → Edit data) and paste the rows.",
    "Sheets 7–9 are staging data: paste them into the Import Projects / Import Assignments / Import Risks tables,",
    "then run the admin Migration screen, which creates the real rows with their lookups. See power-platform/05-migration.md.",
    "",
    `Source: ${path.basename(input)}  ·  sheets read: ${plan.sheetsRead.join(", ") || "none"}  ·  rows read: ${plan.rowsRead}`,
    `Result: ${projects.length} projects, ${projects.reduce((s, p) => s + p.assignments.length, 0)} assignments, ${projects.reduce((s, p) => s + p.risks.length, 0)} risks, ${people.length} people`,
    `Issues: ${errors.length} errors (rows skipped), ${plan.issues.length - errors.length} warnings. Listed on the Issues sheet.`,
    "",
    "People's emails aren't in the legacy sheet. Fill the Email column on sheet 6 before loading, so each person can be",
    "matched to their Teams account and see their own assignments.",
  ].forEach((t, i) => {
    const c = readme.getCell(`A${i + 1}`);
    c.value = t;
    if (i === 0) c.font = { bold: true, size: 14 };
  });

  sheet("1 Territories", [{ header: "Name", key: "name", width: 10 }, { header: "Full name", key: "full", width: 24 }], territories.map((t) => ({ name: t, full: KNOWN_TERRITORIES[t.toUpperCase()] ?? "" })));
  sheet(
    "2 Capabilities",
    [{ header: "Name", key: "name", width: 10 }, { header: "Description", key: "desc", width: 28 }],
    capabilities.map((c) => ({ name: c, desc: KNOWN_CAPABILITIES[c.toUpperCase()] ?? "" })),
  );
  sheet("3 Industries", [{ header: "Name", key: "name", width: 32 }], industries.map((name) => ({ name })));
  sheet("4 Lines of service", [{ header: "Name", key: "name", width: 26 }, { header: "Territory", key: "territory", width: 12 }], linesOfService);
  sheet("5 Clients", [{ header: "Name", key: "name", width: 40 }, { header: "Industry", key: "industry", width: 28 }], clients);
  sheet(
    "6 People",
    [
      { header: "Name", key: "name", width: 28 },
      { header: "Email", key: "email", width: 34 },
      { header: "Grade", key: "grade", width: 18 },
      { header: "Territory", key: "territory", width: 12 },
      { header: "Primary capability", key: "cap", width: 18 },
    ],
    people.map((name) => {
      const first = projects.find((p) => p.assignments.some((a) => key(a.person) === key(name)));
      const a = first?.assignments.find((x) => key(x.person) === key(name));
      return { name, email: "", grade: "", territory: first?.territory ?? "", cap: a?.capability ?? "" };
    }),
  );
  sheet(
    "7 Import Projects",
    [
      { header: "Project name", key: "name", width: 44 },
      { header: "Client", key: "client", width: 32 },
      { header: "Industry", key: "industry", width: 22 },
      { header: "Line of service", key: "los", width: 20 },
      { header: "Territory", key: "territory", width: 10 },
      { header: "Status", key: "status", width: 10 },
      { header: "RAG", key: "rag", width: 8 },
      { header: "Start date", key: "start", width: 12, date: true },
      { header: "End date", key: "end", width: 12, date: true },
      { header: "Multi-tower", key: "multi", width: 11 },
      { header: "Engagement leads", key: "leads", width: 30 },
      { header: "Scope", key: "scope", width: 60 },
    ],
    projects.map((p) => ({
      name: p.name,
      client: p.client,
      industry: p.industry ?? "",
      los: p.lineOfService ?? "",
      territory: p.territory,
      status: STATUS[p.status],
      rag: RAG[p.rag],
      start: date(p.startDate),
      end: date(p.endDate),
      multi: p.multiTower ? "Yes" : "No",
      leads: p.engagementLeads.join(", "),
      scope: p.scope ?? "",
    })),
  );
  sheet(
    "8 Import Assignments",
    [
      { header: "Project name", key: "project", width: 44 },
      { header: "Client", key: "client", width: 32 },
      { header: "Project start", key: "pstart", width: 13, date: true },
      { header: "Person", key: "person", width: 28 },
      { header: "Capability", key: "cap", width: 11 },
      { header: "Allocation %", key: "alloc", width: 12 },
      { header: "Start date", key: "start", width: 12, date: true },
      { header: "End date", key: "end", width: 12, date: true },
    ],
    projects.flatMap((p) =>
      p.assignments.map((a) => ({
        project: p.name,
        client: p.client,
        pstart: date(p.startDate),
        person: a.person,
        cap: a.capability ?? "",
        alloc: a.allocation,
        start: date(p.startDate),
        end: date(p.endDate),
      })),
    ),
  );
  sheet(
    "9 Import Risks",
    [
      { header: "Project name", key: "project", width: 44 },
      { header: "Client", key: "client", width: 32 },
      { header: "Project start", key: "pstart", width: 13, date: true },
      { header: "Risk", key: "risk", width: 70 },
      { header: "Severity", key: "sev", width: 10 },
      { header: "Status", key: "status", width: 10 },
    ],
    projects.flatMap((p) =>
      p.risks.map((risk) => ({
        project: p.name,
        client: p.client,
        pstart: date(p.startDate),
        risk,
        sev: "Medium",
        status: p.status === "CLOSED" ? "Closed" : "Open",
      })),
    ),
  );
  sheet(
    "Issues",
    [
      { header: "Level", key: "level", width: 10 },
      { header: "Sheet", key: "sheet", width: 18 },
      { header: "Row", key: "row", width: 7 },
      { header: "Message", key: "message", width: 90 },
    ],
    plan.issues,
  );

  await wb.xlsx.writeFile(output);
  console.log(`Wrote ${output}`);
  console.log(
    `  ${projects.length} projects · ${people.length} people · ${clients.length} clients · ` +
      `${projects.reduce((s, p) => s + p.assignments.length, 0)} assignments · ${projects.reduce((s, p) => s + p.risks.length, 0)} risks`,
  );
  console.log(`  ${errors.length} errors (rows skipped), ${plan.issues.length - errors.length} warnings — see the Issues sheet`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
