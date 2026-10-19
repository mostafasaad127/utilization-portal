/**
 * Pure planning logic for importing the legacy utilization spreadsheet.
 * No I/O: takes raw cell rows, returns a normalised plan plus row-level
 * issues. The legacy sheet stores one row per project/resource slice, so rows
 * sharing (project name, client, start date) are merged into one project.
 */
export type RawCell = string | number | boolean | Date | null | undefined;

export type ImportIssue = { sheet: string; row: number; level: "error" | "warning"; message: string };

export type PlannedAssignment = { person: string; allocation: number; capability: string | null };

export type PlannedProject = {
  key: string;
  name: string;
  client: string;
  industry: string | null;
  lineOfService: string | null;
  territory: string;
  status: "PIPELINE" | "ACTIVE" | "ON_HOLD" | "CLOSED";
  rag: "GREEN" | "AMBER" | "RED";
  startDate: Date;
  endDate: Date | null;
  multiTower: boolean;
  engagementLeads: string[];
  scope: string | null;
  risks: string[];
  assignments: PlannedAssignment[];
  sources: string[]; // "Sheet!row" references, for traceability
};

export type ImportPlan = { projects: PlannedProject[]; issues: ImportIssue[]; rowsRead: number; sheetsRead: string[] };

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["projectname", "project"],
  capability: ["capability", "capabilities"],
  status: ["status"],
  rag: ["rag", "ragstatus"],
  start: ["startdate", "start"],
  end: ["enddate", "end"],
  territory: ["territory"],
  client: ["client"],
  multiTower: ["multitower"],
  team: ["teamresources", "resources", "team"],
  industry: ["industry"],
  los: ["los", "lineofservice"],
  leads: ["engagementleadpartner", "engagementlead", "partner"],
  utilization: ["teamutilization", "utilization", "teamutilisation", "utilisation"],
  scope: ["projectscope", "scope"],
  risks: ["riskschallenges", "risks", "challenges"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapHeaders(header: RawCell[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, i) => {
    const h = norm(String(cell ?? ""));
    if (!h) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field] === undefined && aliases.includes(h)) map[field] = i;
    }
  });
  return map;
}

export function isProjectSheet(headerMap: Record<string, number>) {
  return headerMap.name !== undefined && headerMap.client !== undefined && headerMap.start !== undefined;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Accepts Excel dates, serial numbers, ISO strings and "04 June 2025"-style text. "TBD" → null. */
export function parseDate(v: RawCell): Date | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "invalid" : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number") {
    // Excel serial date (1900 system)
    const ms = Math.round((v - 25569) * 86_400_000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? "invalid" : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v).trim();
  if (/^(tbd|tbc|n\/?a|-|ongoing)$/i.test(s)) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const text = /^(\d{1,2})[\s\-/]+([A-Za-z]+)[\s\-/,]+(\d{4})$/.exec(s);
  if (text) {
    const m = MONTHS[text[2].slice(0, 4).toLowerCase()] ?? MONTHS[text[2].slice(0, 3).toLowerCase()];
    if (m !== undefined) return new Date(Date.UTC(+text[3], m, +text[1]));
  }
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s);
  if (dmy) return new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])); // UK day-first
  return "invalid";
}

/** "100%", "100", 1, 0.25 → whole percent. */
export function parsePercent(v: RawCell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Math.round(v <= 2 ? v * 100 : v);
  const s = String(v).trim().replace("%", "");
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n <= 2 && !String(v).includes("%") ? n * 100 : n);
}

function parseStatus(v: RawCell): PlannedProject["status"] | null {
  const s = norm(String(v ?? ""));
  if (!s) return null;
  if (s.startsWith("active") || s === "inprogress" || s === "open") return "ACTIVE";
  if (s.startsWith("closed") || s === "completed" || s === "done") return "CLOSED";
  if (s.includes("hold") || s === "paused") return "ON_HOLD";
  if (s.includes("pipeline") || s === "proposal" || s === "planned") return "PIPELINE";
  return null;
}

function parseRag(v: RawCell): PlannedProject["rag"] | null {
  const s = norm(String(v ?? ""));
  if (s.startsWith("g")) return "GREEN";
  if (s.startsWith("a") || s === "yellow") return "AMBER";
  if (s.startsWith("r")) return "RED";
  return null;
}

const text = (v: RawCell) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return /^#(NAME|REF|VALUE|N\/A|DIV\/0)[?!]?$/i.test(s) ? "" : s;
};
const splitList = (v: RawCell) =>
  text(v)
    .split(/[,;\n]| - |\/(?=\s)/)
    .map((s) => s.trim())
    .filter(Boolean);

export function planImport(sheets: { name: string; rows: RawCell[][] }[]): ImportPlan {
  const issues: ImportIssue[] = [];
  const projects = new Map<string, PlannedProject>();
  let rowsRead = 0;
  const sheetsRead: string[] = [];

  for (const sheet of sheets) {
    // Template helper sheets are never data.
    if (sheet.name.startsWith("_") || /^instructions$/i.test(sheet.name.trim())) continue;
    const headerIdx = sheet.rows.findIndex((r) => isProjectSheet(mapHeaders(r)));
    if (headerIdx === -1) continue;
    sheetsRead.push(sheet.name);
    const h = mapHeaders(sheet.rows[headerIdx]);
    const cell = (r: RawCell[], f: string) => (h[f] === undefined ? undefined : r[h[f]]);

    for (let i = headerIdx + 1; i < sheet.rows.length; i++) {
      const r = sheet.rows[i];
      const rowNo = i + 1;
      const name = text(cell(r, "name")).slice(0, 200);
      if (!name) continue; // blank row
      rowsRead++;
      const err = (message: string) => issues.push({ sheet: sheet.name, row: rowNo, level: "error", message });
      const warn = (message: string) => issues.push({ sheet: sheet.name, row: rowNo, level: "warning", message });

      for (const [f, idx] of Object.entries(h)) {
        if (/^#(NAME|REF|VALUE|N\/A|DIV\/0)/i.test(String(r[idx] ?? ""))) warn(`Formula error in “${f}” column was ignored`);
      }

      const client = text(cell(r, "client")).slice(0, 200);
      if (!client) {
        err(`“${name}” has no client`);
        continue;
      }
      const start = parseDate(cell(r, "start"));
      if (start === null || start === "invalid") {
        err(`“${name}” has a missing or unreadable start date`);
        continue;
      }
      const endRaw = parseDate(cell(r, "end"));
      if (endRaw === "invalid") warn(`End date “${text(cell(r, "end"))}” couldn't be read; treated as TBD`);
      const end = endRaw === "invalid" ? null : endRaw;
      if (end && end < start) warn("End date is before the start date");
      if (!end && parseStatus(cell(r, "status")) === "CLOSED") warn("Closed project has no end date; its team won't count towards utilization");

      const territory = text(cell(r, "territory")).toUpperCase();
      if (!territory) {
        err(`“${name}” has no territory`);
        continue;
      }

      const status = parseStatus(cell(r, "status"));
      if (!status) warn(`Status “${text(cell(r, "status"))}” not recognised; set to Active`);
      const rag = parseRag(cell(r, "rag"));
      if (!rag) warn(`RAG “${text(cell(r, "rag"))}” not recognised; set to Green`);

      const key = `${norm(name)}|${norm(client)}|${start.toISOString().slice(0, 10)}`;
      let p = projects.get(key);
      if (!p) {
        p = {
          key,
          name,
          client,
          industry: text(cell(r, "industry")).slice(0, 200) || null,
          lineOfService: text(cell(r, "los")).slice(0, 200) || null,
          territory,
          status: status ?? "ACTIVE",
          rag: rag ?? "GREEN",
          startDate: start,
          endDate: end,
          multiTower: /^y/i.test(text(cell(r, "multiTower"))),
          // The legacy sheet sometimes holds a line of service instead of a person here.
          engagementLeads: splitList(cell(r, "leads"))
            .filter((l) => norm(l) !== norm(text(cell(r, "los"))))
            .map((l) => l.slice(0, 120))
            .slice(0, 10),
          scope: text(cell(r, "scope")).slice(0, 5000) || null,
          risks: [],
          assignments: [],
          sources: [],
        };
        projects.set(key, p);
      } else {
        const scope = text(cell(r, "scope"));
        if (scope && !(p.scope ?? "").includes(scope)) p.scope = p.scope ? `${p.scope}\n\n${scope}` : scope;
      }
      p.sources.push(`${sheet.name}!${rowNo}`);

      for (const risk of text(cell(r, "risks"))
        .split(/\n|(?:^|\s)-\s+/)
        .map((s) => s.replace(/^[-•\s]+/, "").trim())
        .filter((s) => s.length > 2 && !/^n\/?a$/i.test(s))) {
        if (!p.risks.includes(risk)) p.risks.push(risk);
      }

      const people = text(cell(r, "team"))
        .split(/[,;\n&]| and /)
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean);
      const caps = text(cell(r, "capability"))
        .split(/[,;/]/)
        .map((s) => s.trim().slice(0, 10))
        .filter(Boolean);
      const pct = parsePercent(cell(r, "utilization"));
      if (people.length === 0) warn(`“${name}” has no team resources`);
      if (pct === 0 && people.length > 0) warn("Utilization is 0%; assignment imported at 0% is skipped");
      if (pct !== null && pct > 0) {
        people.forEach((person, idx) => {
          if (p!.assignments.some((a) => a.person.toLowerCase() === person.toLowerCase())) return;
          p!.assignments.push({ person, allocation: Math.min(pct, 200), capability: caps[Math.min(idx, caps.length - 1)] ?? null });
        });
      } else if (pct === null && people.length > 0) {
        warn("No utilization % given; team imported at 100%");
        people.forEach((person, idx) => {
          if (!p!.assignments.some((a) => a.person.toLowerCase() === person.toLowerCase())) {
            p!.assignments.push({ person, allocation: 100, capability: caps[Math.min(idx, caps.length - 1)] ?? null });
          }
        });
      }
    }
  }

  if (sheetsRead.length === 0) {
    issues.push({ sheet: "-", row: 0, level: "error", message: "No sheet with Project Name, Client and Start_Date columns was found." });
  }
  return { projects: Array.from(projects.values()), issues, rowsRead, sheetsRead };
}
