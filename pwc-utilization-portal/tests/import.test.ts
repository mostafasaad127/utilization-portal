import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseDate, parsePercent, planImport } from "@/lib/import/plan";
import { readWorkbook } from "@/lib/import/workbook";

const HEADERS = [
  "Project Name", "Capability", "Status", "RAG", "Start_Date", "End_Date", "Territory", "Client", "Multi Tower",
  "Team Resources", "Industry", "LoS", "Engagement Lead/Partner", "Team Utilization %", "Project Scope", "Risks/Challenges",
];

async function legacyWorkbook() {
  const wb = new ExcelJS.Workbook();
  const current = wb.addWorksheet("FY27-Current");
  current.addRow(HEADERS);
  current.addRow(["Woodgrove Bank", "BA", "Closed", "Green", new Date(Date.UTC(2025, 10, 2)), new Date(Date.UTC(2025, 10, 30)), "ME", "Woodgrove Bank", "Yes",
    "Omar Farouk", "Financial Services", "ME D&C – FS", "Casey Brooks", 1, "Field validation of 50 core processes.",
    "- Lack of some data availability with SHs.\n- Processes are complicated between different SHs."]);
  current.addRow(["Contoso", "BA", "Closed", "Green", new Date(Date.UTC(2025, 6, 9)), "TBD", "ME", "Contoso Bank", "No",
    "Adham Rizk", "Financial Services", "ME D&C – FS", "Alex Morgan", 0, "", ""]);
  current.addRow(["Case Management 2.0 : Service Rollout", "PM,BA", "Closed", "Green", "01 April 2026", "14 August 2026", "ME", "Relecloud Community Services", "No",
    "Nour El Sayed, Mariam Adel", "Social Sector", "ME D&C – FS", "Sam Taylor", "100%", "", ""]);
  // Same project split across two rows (one per resource) must merge.
  current.addRow(["Valuation Workflow Refresh", "SD", "Closed", "Green", new Date(Date.UTC(2024, 10, 1)), new Date(Date.UTC(2026, 5, 1)), "UK", "UK Deals", "No",
    "Laila Hegazy", "Deals", "UK Tech Catalyst", "UK Tech Catalyst", 0.3, "", "#NAME?"]);
  current.addRow(["Valuation Workflow Refresh", "SD", "Closed", "Green", new Date(Date.UTC(2024, 10, 1)), new Date(Date.UTC(2026, 5, 1)), "UK", "UK Deals", "No",
    "Amr Shawky", "Deals", "UK Tech Catalyst", "UK Tech Catalyst", 0.5, "", ""]);
  current.addRow(["No Client Project", "BA", "Active", "Green", new Date(Date.UTC(2026, 0, 1)), null, "UK", "", "No", "Someone", "", "", "", 1, "", ""]);
  const archived = wb.addWorksheet("FY26-Archived");
  archived.addRow(HEADERS);
  archived.addRow(["Evidence Library", "BA", "Closed", "Green", new Date(Date.UTC(2025, 11, 15)), new Date(Date.UTC(2026, 0, 9)), "UK", "UK Audit", "Yes",
    "Ziad Helmy", "Audit", "UK Tech Catalyst", "Jordan Lee", 0.5, "", ""]);
  wb.addWorksheet("Sheet2").addRow(["unrelated", "data"]);
  const buf = await wb.xlsx.writeBuffer();
  return new File([buf], "utilization.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("import value parsing", () => {
  it("reads the date formats found in the legacy sheet", () => {
    expect((parseDate("04 June 2025") as Date).toISOString().slice(0, 10)).toBe("2025-06-04");
    expect((parseDate("23 Sept 2025") as Date).toISOString().slice(0, 10)).toBe("2025-09-23");
    expect((parseDate("15/12/2025") as Date).toISOString().slice(0, 10)).toBe("2025-12-15");
    expect(parseDate("TBD")).toBeNull();
    expect(parseDate("someday")).toBe("invalid");
  });
  it("reads percentages as fractions, numbers or text", () => {
    expect(parsePercent(1)).toBe(100);
    expect(parsePercent(0.25)).toBe(25);
    expect(parsePercent("50%")).toBe(50);
    expect(parsePercent("")).toBeNull();
  });
});

describe("spreadsheet import", () => {
  it("reads every project sheet, merges split rows and reports issues", async () => {
    const plan = planImport(await readWorkbook(await legacyWorkbook()));

    expect(plan.sheetsRead).toEqual(["FY27-Current", "FY26-Archived"]);
    expect(plan.projects.map((p) => p.name)).toEqual([
      "Woodgrove Bank", "Contoso", "Case Management 2.0 : Service Rollout", "Valuation Workflow Refresh", "Evidence Library",
    ]);

    const bm = plan.projects[0];
    expect(bm.multiTower).toBe(true);
    expect(bm.risks).toHaveLength(2);
    expect(bm.assignments).toEqual([{ person: "Omar Farouk", allocation: 100, capability: "BA" }]);

    const anb = plan.projects[1];
    expect(anb.endDate).toBeNull(); // TBD
    expect(anb.assignments).toHaveLength(0); // 0% row is not an assignment

    const icm = plan.projects[2];
    expect(icm.assignments).toEqual([
      { person: "Nour El Sayed", allocation: 100, capability: "PM" },
      { person: "Mariam Adel", allocation: 100, capability: "BA" },
    ]);

    const vfp = plan.projects[3];
    expect(vfp.assignments.map((a) => [a.person, a.allocation])).toEqual([["Laila Hegazy", 30], ["Amr Shawky", 50]]);
    expect(vfp.engagementLeads).toEqual([]); // LoS mistakenly typed into the lead column is dropped
    expect(vfp.risks).toEqual([]); // #NAME? ignored

    expect(plan.issues.some((i) => i.level === "error" && i.message.includes("no client"))).toBe(true);
    expect(plan.issues.some((i) => i.level === "warning" && i.message.includes("Formula error"))).toBe(true);
  });

  it("rejects files that aren't xlsx workbooks", async () => {
    await expect(readWorkbook(new File(["hello"], "data.xlsx"))).rejects.toThrow(/doesn't look like an Excel workbook/);
    await expect(readWorkbook(new File(["a,b"], "data.csv"))).rejects.toThrow(/\.xlsx/);
  });
});

describe("zip bomb protection", () => {
  it("rejects archives whose declared uncompressed size is too large", async () => {
    // A minimal zip whose central directory claims a 200 MB entry.
    const name = Buffer.from("xl/a.xml");
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt32LE(200 * 1024 * 1024, 24);
    cd.writeUInt16LE(name.length, 28);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length + name.length, 12);
    eocd.writeUInt32LE(4, 16);
    const buf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), cd, name, eocd]);
    await expect(readWorkbook(new File([buf], "bomb.xlsx"))).rejects.toThrow(/too large/);
  });
});

describe("template helper sheets", () => {
  it("never imports the Instructions or hidden list sheets", () => {
    const header = ["Project Name", "Client", "Start_Date", "Territory"];
    const plan = planImport([
      { name: "Instructions", rows: [header, ["Example", "Client", "01 Jan 2026", "UK"]] },
      { name: "_Lists", rows: [header, ["X", "Y", "01 Jan 2026", "UK"]] },
      { name: "Projects", rows: [header, ["Real", "Client A", "01 Jan 2026", "UK"]] },
    ]);
    expect(plan.sheetsRead).toEqual(["Projects"]);
    expect(plan.projects.map((p) => p.name)).toEqual(["Real"]);
  });
});
