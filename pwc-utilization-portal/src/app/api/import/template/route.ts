import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Downloadable import template. Columns match exactly what the importer
 * expects (same headers as the legacy utilization sheet), with dropdowns
 * built from the portal's current reference data and an instructions sheet.
 * Admin-only, authenticated in the handler (the proxy does not run on /api).
 */
const MAX_ROWS = 1000;

const COLUMNS: { header: string; key: string; width: number; required: boolean; guide: string; example: string }[] = [
  { header: "Project Name", key: "name", width: 40, required: true, guide: "Name of the engagement. Rows with the same name, client and start date are merged into one project.", example: "Woodgrove – Core Process Validation" },
  { header: "Capability", key: "capability", width: 13, required: false, guide: "Capability code(s). For several people on one row, list codes in the same order as the people, comma-separated.", example: "PM,BA" },
  { header: "Status", key: "status", width: 11, required: false, guide: "Active, Closed, On hold or Pipeline. Defaults to Active.", example: "Active" },
  { header: "RAG", key: "rag", width: 9, required: false, guide: "Green, Amber or Red. Defaults to Green.", example: "Green" },
  { header: "Start_Date", key: "start", width: 14, required: true, guide: "Date the project starts. Excel date, or text like 04 June 2025.", example: "02 Nov 2025" },
  { header: "End_Date", key: "end", width: 14, required: false, guide: "Date the project ends, or TBD. A Closed project should have an end date.", example: "TBD" },
  { header: "Territory", key: "territory", width: 10, required: true, guide: "Territory code, e.g. ME or UK. Must already exist in the portal.", example: "ME" },
  { header: "Client", key: "client", width: 32, required: true, guide: "Client name. New clients are created automatically.", example: "Woodgrove Bank" },
  { header: "Multi Tower", key: "multiTower", width: 12, required: false, guide: "Yes or No.", example: "Yes" },
  { header: "Team Resources", key: "team", width: 32, required: false, guide: "Person name(s), comma-separated. Matched to the resource pool by name; new people are created.", example: "Nour El Sayed, Mariam Adel" },
  { header: "Industry", key: "industry", width: 20, required: false, guide: "Industry name. New industries are created.", example: "Financial Services" },
  { header: "LoS", key: "los", width: 18, required: false, guide: "Line of service. New ones are created in the row's territory.", example: "ME D&C – FS" },
  { header: "Engagement Lead/Partner", key: "leads", width: 28, required: false, guide: "Lead or partner names, comma-separated.", example: "Casey Brooks" },
  { header: "Team Utilization %", key: "utilization", width: 18, required: false, guide: "Allocation for the people on this row, e.g. 100% or 50%. Blank = 100%; 0% rows don't create assignments.", example: "100%" },
  { header: "Project Scope", key: "scope", width: 50, required: false, guide: "Objectives and deliverables.", example: "Field validation of 50 core banking processes." },
  { header: "Risks/Challenges", key: "risks", width: 50, required: false, guide: "One risk per line (Alt+Enter), optionally starting with “- ”. Each becomes a risk on the project.", example: "- Limited data availability\n- Processes span several teams" },
];

const ORANGE = "FFD04A02";
const DARK = "FF2D2D2D";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const [territories, capabilities, linesOfService, industries] = await Promise.all([
    db.territory.findMany({ orderBy: { code: "asc" }, select: { code: true, name: true } }),
    db.capability.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    db.lineOfService.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
    db.industry.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Utilization Portal";
  wb.created = new Date();

  // ── Projects sheet: the one to fill in ────────────────────────────────────
  const ws = wb.addWorksheet("Projects", { views: [{ state: "frozen", ySplit: 1 }], properties: { tabColor: { argb: ORANGE } } });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell, col) => {
    const def = COLUMNS[col - 1];
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: def.required ? ORANGE : DARK } };
    cell.alignment = { vertical: "middle" };
    cell.note = `${def.required ? "Required. " : ""}${def.guide}`;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  // ── Hidden lists that feed the dropdowns ──────────────────────────────────
  const lists = wb.addWorksheet("_Lists", { state: "veryHidden" });
  const listCols: Record<string, string[]> = {
    Status: ["Active", "Closed", "On hold", "Pipeline"],
    RAG: ["Green", "Amber", "Red"],
    Territory: territories.map((t) => t.code),
    "Multi Tower": ["Yes", "No"],
    Capability: capabilities.map((c) => c.code),
    LoS: linesOfService.map((l) => l.name),
    Industry: industries.map((i) => i.name),
  };
  const range: Record<string, string> = {};
  Object.entries(listCols).forEach(([name, values], i) => {
    const col = String.fromCharCode(65 + i);
    lists.getCell(`${col}1`).value = name;
    values.forEach((v, r) => (lists.getCell(`${col}${r + 2}`).value = v));
    range[name] = `_Lists!$${col}$2:$${col}$${Math.max(2, values.length + 1)}`;
  });

  const colLetter = (key: string) => ws.getColumn(key).letter;
  const validate = (key: string, rule: ExcelJS.DataValidation) => {
    for (let r = 2; r <= MAX_ROWS + 1; r++) ws.getCell(`${colLetter(key)}${r}`).dataValidation = rule;
  };
  const list = (name: string, strict: boolean, prompt: string): ExcelJS.DataValidation => ({
    type: "list",
    allowBlank: true,
    formulae: [range[name]],
    showInputMessage: true,
    promptTitle: name,
    prompt,
    showErrorMessage: true,
    errorStyle: strict ? "stop" : "warning",
    errorTitle: `Unknown ${name.toLowerCase()}`,
    error: strict ? `Choose a value from the list.` : `Not in the portal yet. It will be created on import. Continue?`,
  });

  validate("status", list("Status", true, "Active, Closed, On hold or Pipeline"));
  validate("rag", list("RAG", true, "Green, Amber or Red"));
  validate("territory", list("Territory", true, "Must already exist in the portal"));
  validate("multiTower", list("Multi Tower", true, "Yes or No"));
  validate("los", list("LoS", false, "Pick a line of service, or type a new one"));
  validate("industry", list("Industry", false, "Pick an industry, or type a new one"));
  // Several codes can share a cell ("PM,BA"), so the list is a suggestion, not a rule.
  validate("capability", { ...list("Capability", false, "Code, or several separated by commas (e.g. PM,BA)"), errorStyle: "information" });
  for (const key of ["start", "end"]) {
    validate(key, {
      type: "date",
      operator: "greaterThan",
      formulae: [new Date(Date.UTC(2000, 0, 1))],
      allowBlank: true,
      showInputMessage: true,
      promptTitle: key === "start" ? "Start date" : "End date",
      prompt: key === "start" ? "Required. A date, e.g. 04 Jun 2025" : "A date, or type TBD",
      showErrorMessage: true,
      errorStyle: key === "end" ? "information" : "warning",
      error: "Use a date (or TBD for the end date).",
    });
    ws.getColumn(key).numFmt = "dd mmm yyyy";
  }
  validate("utilization", {
    type: "decimal",
    operator: "between",
    formulae: [0, 2],
    allowBlank: true,
    showInputMessage: true,
    promptTitle: "Allocation",
    prompt: "Percentage of time, e.g. 100% or 50%",
    showErrorMessage: true,
    errorStyle: "warning",
    error: "Enter a percentage between 0% and 200%.",
  });
  ws.getColumn("utilization").numFmt = "0%";
  for (const key of ["scope", "risks"]) ws.getColumn(key).alignment = { wrapText: true, vertical: "top" };

  // ── Instructions sheet ────────────────────────────────────────────────────
  const info = wb.addWorksheet("Instructions", { properties: { tabColor: { argb: DARK } } });
  info.columns = [
    { key: "a", width: 26 },
    { key: "b", width: 11 },
    { key: "c", width: 70 },
    { key: "d", width: 36 },
  ];
  info.getCell("A1").value = "Utilization Portal: project import template";
  info.getCell("A1").font = { bold: true, size: 16 };
  const steps = [
    "1. Fill in the Projects sheet: one row per project, or one row per person on a project (rows are merged).",
    "2. Orange headers are required: Project Name, Start_Date, Territory and Client.",
    "3. In the portal go to Admin → Import spreadsheet, upload the file and review the preview. Nothing is saved until you confirm.",
    "4. Re-importing the same file is safe: projects already in the portal (same name, client and start date) are skipped.",
    "Tip: you can also import your existing workbook directly. Every sheet with these column headers is read.",
  ];
  steps.forEach((t, i) => {
    const c = info.getCell(`A${i + 3}`);
    c.value = t;
    c.font = i === steps.length - 1 ? { italic: true, color: { argb: "FF696969" } } : {};
  });
  const tableTop = steps.length + 5;
  const head = info.getRow(tableTop);
  head.values = ["Column", "Required", "What to enter", "Example"];
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  });
  COLUMNS.forEach((c, i) => {
    const row = info.getRow(tableTop + 1 + i);
    row.values = [c.header, c.required ? "Yes" : "", c.guide, c.example];
    row.alignment = { wrapText: true, vertical: "top" };
    if (c.required) row.getCell(2).font = { bold: true, color: { argb: ORANGE } };
  });
  const refTop = tableTop + COLUMNS.length + 3;
  info.getCell(`A${refTop}`).value = "Values currently in the portal";
  info.getCell(`A${refTop}`).font = { bold: true, size: 13 };
  info.getCell(`A${refTop + 1}`).value = "Territories";
  info.getCell(`C${refTop + 1}`).value = territories.map((t) => `${t.code} (${t.name})`).join(", ");
  info.getCell(`A${refTop + 2}`).value = "Capabilities";
  info.getCell(`C${refTop + 2}`).value = capabilities.map((c) => `${c.code} (${c.name})`).join(", ");
  info.getCell(`A${refTop + 3}`).value = "Lines of service";
  info.getCell(`C${refTop + 3}`).value = linesOfService.map((l) => l.name).join(", ");
  for (let r = refTop + 1; r <= refTop + 3; r++) info.getRow(r).alignment = { wrapText: true, vertical: "top" };

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="utilization-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
