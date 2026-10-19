/**
 * SharePoint data model for the Utilization Portal (Microsoft 365 edition).
 * Mirrors the web portal's Prisma schema. Lists are created in this order
 * because later lists look up earlier ones.
 *
 * Internal names never contain spaces so they're stable in formulas, flows
 * and Power BI; display names are what people see.
 */

export type FieldDef =
  | { type: "Text"; name: string; display: string; required?: boolean; maxLength?: number }
  | { type: "Note"; name: string; display: string; lines?: number }
  | { type: "Number"; name: string; display: string; required?: boolean; min?: number; max?: number }
  | { type: "Boolean"; name: string; display: string; defaultValue?: boolean }
  | { type: "Date"; name: string; display: string; required?: boolean }
  | { type: "Choice"; name: string; display: string; choices: string[]; defaultValue?: string; required?: boolean }
  | { type: "Lookup"; name: string; display: string; list: string; required?: boolean };

/**
 * Who can do what, enforced by SharePoint itself (not just the app):
 *  - "reference":   members read only; owners maintain it.
 *  - "shared":      members read everything and add or edit items.
 *  - "own-edit":    members read everything but only edit items they created.
 *  - "private":     members only see and edit items they created (item-level
 *                   permissions). Owners (admins) always see everything.
 */
export type Access = "reference" | "shared" | "own-edit" | "private";

export type ListDef = {
  key: string; // stable id used in code
  url: string; // list URL segment (no spaces)
  title: string; // display title
  description: string;
  titleDisplay: string; // display name of the built-in Title column
  access: Access;
  fields: FieldDef[];
};

export const GRADES = ["Associate", "Senior Associate", "Manager", "Senior Manager", "Director", "Partner"];
export const STATUSES = ["Pipeline", "Active", "On hold", "Closed"];
export const RAGS = ["Green", "Amber", "Red"];
export const SEVERITIES = ["Low", "Medium", "High", "Critical"];
export const RISK_STATUSES = ["Open", "Mitigating", "Closed"];

export const LISTS: ListDef[] = [
  {
    key: "territories",
    url: "UPTerritories",
    title: "UP Territories",
    description: "Utilization Portal: territories (e.g. UK, ME).",
    titleDisplay: "Code",
    access: "reference",
    fields: [{ type: "Text", name: "FullName", display: "Full name" }],
  },
  {
    key: "capabilities",
    url: "UPCapabilities",
    title: "UP Capabilities",
    description: "Utilization Portal: capabilities (BA, PM, PdM, PO, SD, PD).",
    titleDisplay: "Code",
    access: "reference",
    fields: [{ type: "Text", name: "CapabilityName", display: "Capability" }],
  },
  {
    key: "industries",
    url: "UPIndustries",
    title: "UP Industries",
    description: "Utilization Portal: industries.",
    titleDisplay: "Industry",
    access: "reference",
    fields: [],
  },
  {
    key: "linesOfService",
    url: "UPLinesOfService",
    title: "UP Lines of service",
    description: "Utilization Portal: lines of service.",
    titleDisplay: "Line of service",
    access: "reference",
    fields: [{ type: "Lookup", name: "Territory", display: "Territory", list: "territories" }],
  },
  {
    key: "clients",
    url: "UPClients",
    title: "UP Clients",
    description: "Utilization Portal: clients. Members can add new clients.",
    titleDisplay: "Client",
    access: "shared",
    fields: [
      { type: "Lookup", name: "Industry", display: "Industry", list: "industries" },
      { type: "Boolean", name: "IsInternal", display: "Internal", defaultValue: false },
    ],
  },
  {
    key: "people",
    url: "UPPeople",
    title: "UP People",
    description: "Utilization Portal: the resource pool. Each person can edit their own profile.",
    titleDisplay: "Name",
    access: "own-edit",
    fields: [
      { type: "Text", name: "Email", display: "Email" },
      { type: "Choice", name: "Grade", display: "Grade", choices: GRADES },
      { type: "Lookup", name: "Territory", display: "Territory", list: "territories" },
      { type: "Lookup", name: "PrimaryCapability", display: "Primary capability", list: "capabilities" },
      { type: "Boolean", name: "IsActive", display: "Active", defaultValue: true },
    ],
  },
  {
    key: "projects",
    url: "UPProjects",
    title: "UP Projects",
    description: "Utilization Portal: projects.",
    titleDisplay: "Project name",
    access: "shared",
    fields: [
      { type: "Lookup", name: "Client", display: "Client", list: "clients", required: true },
      { type: "Lookup", name: "Industry", display: "Industry", list: "industries" },
      { type: "Lookup", name: "LineOfService", display: "Line of service", list: "linesOfService" },
      { type: "Lookup", name: "Territory", display: "Territory", list: "territories", required: true },
      { type: "Choice", name: "ProjectStatus", display: "Status", choices: STATUSES, defaultValue: "Active", required: true },
      { type: "Choice", name: "RAG", display: "RAG", choices: RAGS, defaultValue: "Green", required: true },
      { type: "Date", name: "StartDate", display: "Start date", required: true },
      { type: "Date", name: "EndDate", display: "End date" },
      { type: "Boolean", name: "MultiTower", display: "Multi-tower", defaultValue: false },
      { type: "Text", name: "EngagementLeads", display: "Engagement leads" },
      { type: "Note", name: "Scope", display: "Scope", lines: 6 },
      { type: "Date", name: "LastUpdateOn", display: "Last update on" },
    ],
  },
  {
    key: "assignments",
    url: "UPAssignments",
    title: "UP Assignments",
    description: "Utilization Portal: who is on which project, at what allocation. Private: people only see their own.",
    titleDisplay: "Assignment",
    access: "private",
    fields: [
      { type: "Lookup", name: "Project", display: "Project", list: "projects", required: true },
      { type: "Lookup", name: "Person", display: "Person", list: "people", required: true },
      { type: "Text", name: "PersonEmail", display: "Person email" },
      { type: "Lookup", name: "Capability", display: "Capability", list: "capabilities" },
      { type: "Number", name: "Allocation", display: "Allocation %", required: true, min: 0, max: 200 },
      { type: "Date", name: "StartDate", display: "Start date", required: true },
      { type: "Date", name: "EndDate", display: "End date" },
      { type: "Text", name: "AssignmentNote", display: "Note" },
    ],
  },
  {
    key: "risks",
    url: "UPRisks",
    title: "UP Risks",
    description: "Utilization Portal: risks and challenges per project.",
    titleDisplay: "Risk",
    access: "own-edit",
    fields: [
      { type: "Lookup", name: "Project", display: "Project", list: "projects", required: true },
      { type: "Choice", name: "Severity", display: "Severity", choices: SEVERITIES, defaultValue: "Medium", required: true },
      { type: "Choice", name: "RiskStatus", display: "Risk status", choices: RISK_STATUSES, defaultValue: "Open", required: true },
      { type: "Text", name: "RiskOwner", display: "Risk owner" },
      { type: "Note", name: "Mitigation", display: "Mitigation", lines: 4 },
    ],
  },
  {
    key: "updates",
    url: "UPStatusUpdates",
    title: "UP Status updates",
    description: "Utilization Portal: dated status updates with RAG.",
    titleDisplay: "Summary",
    access: "own-edit",
    fields: [
      { type: "Lookup", name: "Project", display: "Project", list: "projects", required: true },
      { type: "Choice", name: "UpdateRAG", display: "RAG", choices: RAGS, defaultValue: "Green", required: true },
      { type: "Note", name: "UpdateText", display: "Update", lines: 6 },
    ],
  },
  {
    key: "admins",
    url: "UPAdmins",
    title: "UP Admins",
    description: "Utilization Portal: who sees the admin screens. Admins must also be site owners.",
    titleDisplay: "Name",
    access: "reference",
    fields: [{ type: "Text", name: "Email", display: "Email" }],
  },
];

export const SEED = {
  territories: [
    { Title: "UK", FullName: "United Kingdom" },
    { Title: "ME", FullName: "Middle East" },
  ],
  capabilities: [
    { Title: "BA", CapabilityName: "Business Analysis" },
    { Title: "PM", CapabilityName: "Project Management" },
    { Title: "PdM", CapabilityName: "Product Management" },
    { Title: "PO", CapabilityName: "Product Ownership" },
    { Title: "SD", CapabilityName: "Service Design" },
    { Title: "PD", CapabilityName: "Product Design" },
  ],
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** SharePoint field schema XML for createfieldasxml. */
export function fieldXml(f: FieldDef, lookupListId?: string): string {
  const base = `DisplayName='${esc(f.display)}' Name='${f.name}' StaticName='${f.name}'`;
  const req = "required" in f && f.required ? " Required='TRUE'" : "";
  switch (f.type) {
    case "Text":
      return `<Field Type='Text' ${base}${req} MaxLength='${f.maxLength ?? 255}'/>`;
    case "Note":
      return `<Field Type='Note' ${base} NumLines='${f.lines ?? 6}' RichText='FALSE' AppendOnly='FALSE'/>`;
    case "Number":
      return `<Field Type='Number' ${base}${req} Decimals='0'${f.min !== undefined ? ` Min='${f.min}'` : ""}${f.max !== undefined ? ` Max='${f.max}'` : ""}/>`;
    case "Boolean":
      return `<Field Type='Boolean' ${base}><Default>${f.defaultValue ? 1 : 0}</Default></Field>`;
    case "Date":
      return `<Field Type='DateTime' ${base}${req} Format='DateOnly' FriendlyDisplayFormat='Disabled'/>`;
    case "Choice":
      return (
        `<Field Type='Choice' ${base}${req} Format='Dropdown' FillInChoice='FALSE'>` +
        (f.defaultValue ? `<Default>${esc(f.defaultValue)}</Default>` : "") +
        `<CHOICES>${f.choices.map((c) => `<CHOICE>${esc(c)}</CHOICE>`).join("")}</CHOICES></Field>`
      );
    case "Lookup":
      if (!lookupListId) throw new Error(`Lookup ${f.name} needs the id of list ${f.list}`);
      return `<Field Type='Lookup' ${base}${req} List='{${lookupListId}}' ShowField='Title'/>`;
  }
}
