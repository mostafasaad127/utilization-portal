/**
 * Development seed. Mirrors the structure of the FY26/FY27 utilization
 * spreadsheet (projects, clients, lines of service, capabilities) with
 * fictional people. Safe to re-run: it wipes and recreates portal data.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Grade, type ProjectStatus, type Rag } from "../src/generated/prisma/client";

// `--if-empty` (used by hosted demo builds) only seeds a database with no users and
// never deletes anything. A full reseed wipes data, so it's refused in production.
const IF_EMPTY = process.argv.includes("--if-empty");
if (process.env.NODE_ENV === "production" && !IF_EMPTY) {
  throw new Error("Refusing to wipe and reseed a production database.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// Deterministic PRNG so every developer gets the same data.
let seed = 20261012;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const TERRITORIES = [
  { code: "ME", name: "Middle East" },
  { code: "UK", name: "United Kingdom" },
];

const CAPABILITIES = [
  { code: "BA", name: "Business Analysis" },
  { code: "PM", name: "Project Management" },
  { code: "PdM", name: "Product Management" },
  { code: "PO", name: "Product Ownership" },
  { code: "SD", name: "Service Design" },
  { code: "PD", name: "Product Design" },
];

const INDUSTRIES = [
  "Healthcare Industry",
  "Financial Services",
  "Social Sector",
  "Education",
  "Internal Services",
  "Risk",
  "Deals",
  "Audit",
  "Government & Public Services",
];

const LINES_OF_SERVICE = [
  { name: "ME S&T", territory: "ME" },
  { name: "ME D&C – FS", territory: "ME" },
  { name: "ME Operate", territory: "ME" },
  { name: "UK Risk", territory: "UK" },
  { name: "UK Tech Catalyst", territory: "UK" },
  { name: "UK CLT", territory: "UK" },
];

const CLIENTS: { name: string; industry: string; internal?: boolean }[] = [
  { name: "Lamna Healthcare", industry: "Healthcare Industry" },
  { name: "Woodgrove Bank", industry: "Financial Services" },
  { name: "Contoso Bank", industry: "Financial Services" },
  { name: "Relecloud Community Services", industry: "Social Sector" },
  { name: "Northwind College Group", industry: "Education" },
  { name: "Humongous Insurance", industry: "Financial Services" },
  { name: "Firm Internal", industry: "Internal Services", internal: true },
  { name: "Internal – Cyber Risk", industry: "Risk", internal: true },
  { name: "Internal – Channel Islands", industry: "Financial Services", internal: true },
  { name: "UK Deals", industry: "Deals", internal: true },
  { name: "UK IFS / Business Solutions", industry: "Internal Services", internal: true },
  { name: "UK CLT", industry: "Internal Services", internal: true },
  { name: "Tailspin Bank", industry: "Financial Services" },
  { name: "UK Audit", industry: "Audit", internal: true },
  { name: "Lucerne Education Authority", industry: "Education" },
];

const PEOPLE: { name: string; grade: Grade; territory: string; capability: string; email?: string }[] = [
  { name: "Omar Farouk", grade: "SENIOR_ASSOCIATE", territory: "ME", capability: "BA" },
  { name: "Youssef Nabil", grade: "MANAGER", territory: "ME", capability: "BA" },
  { name: "Mariam Adel", grade: "ASSOCIATE", territory: "ME", capability: "BA" },
  { name: "Nour El Sayed", grade: "SENIOR_ASSOCIATE", territory: "ME", capability: "PM" },
  { name: "Hana Mansour", grade: "SENIOR_MANAGER", territory: "UK", capability: "PdM" },
  { name: "Tarek Fawzy", grade: "SENIOR_ASSOCIATE", territory: "UK", capability: "PdM" },
  { name: "Salma Ibrahim", grade: "MANAGER", territory: "UK", capability: "PO" },
  { name: "Khaled Ramzy", grade: "SENIOR_ASSOCIATE", territory: "UK", capability: "PO" },
  { name: "Laila Hegazy", grade: "MANAGER", territory: "UK", capability: "SD" },
  { name: "Amr Shawky", grade: "SENIOR_ASSOCIATE", territory: "UK", capability: "SD" },
  { name: "Dina Wahba", grade: "ASSOCIATE", territory: "UK", capability: "PD" },
  { name: "Mostafa Galal", grade: "SENIOR_ASSOCIATE", territory: "UK", capability: "BA" },
  { name: "Rana Zaki", grade: "ASSOCIATE", territory: "UK", capability: "BA" },
  { name: "Ziad Helmy", grade: "MANAGER", territory: "UK", capability: "BA" },
  { name: "Farida Lotfy", grade: "SENIOR_ASSOCIATE", territory: "ME", capability: "PM" },
  { name: "Sherif Kamal", grade: "DIRECTOR", territory: "ME", capability: "PM" },
  { name: "Yasmin Saber", grade: "ASSOCIATE", territory: "UK", capability: "PD" },
  { name: "Adham Rizk", grade: "SENIOR_ASSOCIATE", territory: "ME", capability: "BA" },
  { name: "Habiba Naguib", grade: "ASSOCIATE", territory: "ME", capability: "SD" },
  { name: "Karim Abdelaziz", grade: "SENIOR_MANAGER", territory: "UK", capability: "PdM" },
  { name: "Malak Tawfik", grade: "ASSOCIATE", territory: "UK", capability: "PO" },
  { name: "Seif Badawi", grade: "SENIOR_ASSOCIATE", territory: "UK", capability: "PM" },
  // Linked to the admin dev persona.
  { name: "Portal Admin", grade: "SENIOR_MANAGER", territory: "UK", capability: "PdM", email: "admin@pwc.com" },
];

const LEADS = [
  "Sarah Whitfield", "James Carter", "Priya Raman", "Daniel Hughes", "Leila Haddad", "Tom Ashworth",
  "Fatima Al Qasimi", "Oliver Bennett", "Rachel Moore", "Ahmed Al Mansoori", "Emma Clarke", "Nick Lawson",
];

type ProjectSeed = {
  name: string; capability: string[]; status: ProjectStatus; rag: Rag; start: string; end: string | null;
  territory: string; client: string; multiTower: boolean; industry: string; los: string; scope?: string;
  team: [person: string, allocation: number][]; risks?: [title: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"][];
};

const PROJECTS: ProjectSeed[] = [
  { name: "Patient Flow Process Excellence", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-06-04", end: "2026-02-28", territory: "ME", client: "Lamna Healthcare", multiTower: true, industry: "Healthcare Industry", los: "ME S&T",
    team: [["Omar Farouk", 100]], risks: [["Requirements evolving across multiple stakeholders and industries", "MEDIUM"]] },
  { name: "Woodgrove – Core Process Validation", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-11-02", end: "2025-11-30", territory: "ME", client: "Woodgrove Bank", multiTower: true, industry: "Financial Services", los: "ME D&C – FS",
    scope: "Field validation of 50 core banking processes with stakeholders across the bank as part of core process re-engineering. Bottlenecks captured and improvement areas presented to management for each process.",
    team: [["Youssef Nabil", 100]], risks: [["Limited data availability with some stakeholders", "MEDIUM"], ["Processes span several stakeholder groups with redundancies", "LOW"]] },
  { name: "Woodgrove – Phase 2", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2026-01-11", end: "2026-02-05", territory: "ME", client: "Woodgrove Bank", multiTower: true, industry: "Financial Services", los: "ME D&C – FS",
    team: [["Youssef Nabil", 100]] },
  { name: "Contoso Digital Requirements", capability: ["BA"], status: "ACTIVE", rag: "GREEN", start: "2025-07-09", end: null, territory: "ME", client: "Contoso Bank", multiTower: false, industry: "Financial Services", los: "ME D&C – FS",
    scope: "Enhance existing BRDs that lack client requirements, covering all gaps and aligning to the target operating model.",
    team: [["Adham Rizk", 50]] },
  { name: "Case Management 2.0: Service Rollout – Family Services Redesign", capability: ["PM", "BA"], status: "CLOSED", rag: "GREEN", start: "2026-04-01", end: "2026-08-14", territory: "ME", client: "Relecloud Community Services", multiTower: false, industry: "Social Sector", los: "ME D&C – FS",
    team: [["Nour El Sayed", 100], ["Mariam Adel", 100]] },
  { name: "Northwind – Student Funding Scheme", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-11-23", end: "2026-01-31", territory: "ME", client: "Northwind College Group", multiTower: false, industry: "Education", los: "ME Operate",
    scope: "Implement a Private University Student Funding Scheme enabling students to access private higher education through a partnership model.",
    team: [["Farida Lotfy", 100]], risks: [["Securing private-sector funding is a dependency", "HIGH"]] },
  { name: "Humongous Insurance Digital Strategy", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2026-02-18", end: "2026-03-27", territory: "UK", client: "Humongous Insurance", multiTower: false, industry: "Financial Services", los: "UK Risk",
    scope: "Assess current-state technology and digital capabilities, benchmark against competitors, identify gaps and opportunities, and develop a prioritised roadmap of digital initiatives supported by a high-level business case.",
    team: [["Mostafa Galal", 100]] },
  { name: "AI Requirements Assistant", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2026-04-23", end: "2026-08-20", territory: "UK", client: "Firm Internal", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    scope: "Agentic assistant for requirements workflows while maintaining full human control and auditability. Includes integration with Azure DevOps and prompt management capabilities.",
    team: [["Mostafa Galal", 100]] },
  { name: "Cyber Risk Self-Assessment", capability: ["PdM"], status: "CLOSED", rag: "GREEN", start: "2025-11-06", end: "2025-11-29", territory: "UK", client: "Internal – Cyber Risk", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    team: [["Tarek Fawzy", 100]] },
  { name: "Client Risk Register", capability: ["PdM"], status: "ACTIVE", rag: "GREEN", start: "2025-12-15", end: "2026-09-15", territory: "UK", client: "Internal – Channel Islands", multiTower: true, industry: "Risk", los: "UK Tech Catalyst",
    team: [["Tarek Fawzy", 25], ["Hana Mansour", 25]], risks: [["Proven repeatable outcomes in productivity and engagement still to be evidenced", "LOW"]] },
  { name: "Deal Insights PoC", capability: ["PdM"], status: "CLOSED", rag: "GREEN", start: "2026-03-16", end: "2026-06-30", territory: "UK", client: "UK Deals", multiTower: false, industry: "Deals", los: "UK Tech Catalyst",
    scope: "Transition the deal insights idea from a broad conceptual vision into an engineer-ready PoC with defined data sources, features and build artefacts.",
    team: [["Tarek Fawzy", 50]] },
  { name: "Acquisition Modelling Tool – Analysis", capability: ["PO"], status: "CLOSED", rag: "GREEN", start: "2025-05-10", end: "2025-10-23", territory: "UK", client: "UK Deals", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    team: [["Khaled Ramzy", 100]] },
  { name: "Smart Room Booking", capability: ["PO"], status: "CLOSED", rag: "GREEN", start: "2025-09-11", end: "2025-12-12", territory: "UK", client: "UK IFS / Business Solutions", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    team: [["Khaled Ramzy", 100]] },
  { name: "Quality Review Tool", capability: ["PO"], status: "CLOSED", rag: "GREEN", start: "2026-01-12", end: "2026-02-27", territory: "UK", client: "UK IFS / Business Solutions", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    scope: "High-level system requirements definition and document & evidence management.",
    team: [["Khaled Ramzy", 100]], risks: [["Security / retention constraints on sensitive records may limit UX and sharing patterns", "MEDIUM"]] },
  { name: "Carve-out Accelerator", capability: ["PdM"], status: "ACTIVE", rag: "GREEN", start: "2026-02-27", end: "2026-12-31", territory: "UK", client: "UK CLT", multiTower: true, industry: "Internal Services", los: "UK Tech Catalyst",
    team: [["Karim Abdelaziz", 100], ["Malak Tawfik", 100]], risks: [["Adoption risk: users reverting to email and side trackers if intake isn't frictionless", "MEDIUM"]] },
  { name: "Valuation Workflow Refresh", capability: ["SD"], status: "CLOSED", rag: "GREEN", start: "2024-11-01", end: "2026-06-01", territory: "UK", client: "UK Deals", multiTower: false, industry: "Deals", los: "UK Tech Catalyst",
    team: [["Laila Hegazy", 30]] },
  { name: "Operating Model Rewiring", capability: ["SD"], status: "CLOSED", rag: "AMBER", start: "2025-06-10", end: "2026-06-30", territory: "UK", client: "Firm Internal", multiTower: true, industry: "Internal Services", los: "UK Tech Catalyst",
    scope: "AI / automation opportunity assessment and complexity drivers.",
    team: [["Laila Hegazy", 50]] },
  { name: "Service Catalogue Refresh", capability: ["SD"], status: "CLOSED", rag: "GREEN", start: "2026-01-11", end: "2026-01-22", territory: "UK", client: "UK IFS / Business Solutions", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    scope: "Re-categorise team services to be more relevant and easier to understand based on stakeholder feedback and personas.",
    team: [["Amr Shawky", 25]] },
  { name: "Valuation Workflow Refresh – Phase 2", capability: ["SD"], status: "ACTIVE", rag: "GREEN", start: "2026-05-06", end: "2026-11-30", territory: "UK", client: "UK Deals", multiTower: false, industry: "Deals", los: "UK Tech Catalyst",
    team: [["Laila Hegazy", 60], ["Amr Shawky", 50]] },
  { name: "Lending Product Integration", capability: ["PD"], status: "ACTIVE", rag: "GREEN", start: "2026-01-04", end: "2027-12-31", territory: "UK", client: "Tailspin Bank", multiTower: true, industry: "Financial Services", los: "UK CLT",
    scope: "Integrating new and tailored lending products into the bank's app to replace legacy in-house products. Includes design supervision, audit and implementation to maintain user-experience integrity, alongside development and quality assurance.",
    team: [["Dina Wahba", 100], ["Yasmin Saber", 100]], risks: [["Legacy product data migration may slip release dates", "HIGH"]] },
  { name: "Audit Quality Automation", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-01-08", end: "2025-10-31", territory: "UK", client: "UK Audit", multiTower: false, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Ziad Helmy", 100]] },
  { name: "Audit Insights Platform – Reporting", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-09-09", end: "2026-03-06", territory: "UK", client: "UK Audit", multiTower: false, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Ziad Helmy", 50], ["Rana Zaki", 100]] },
  { name: "Audit Analytics Program – Engagement Planning Suite", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-10-17", end: "2026-03-20", territory: "UK", client: "UK Audit", multiTower: true, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Rana Zaki", 50]] },
  { name: "Evidence Library", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2025-12-15", end: "2026-01-09", territory: "UK", client: "UK Audit", multiTower: true, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Ziad Helmy", 50]] },
  { name: "Audit Analytics Program – Fees Module", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2026-02-02", end: "2026-03-20", territory: "UK", client: "UK Audit", multiTower: false, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Rana Zaki", 50]] },
  { name: "Audit Analytics Program – Report Builder", capability: ["BA"], status: "CLOSED", rag: "GREEN", start: "2026-02-02", end: "2026-02-20", territory: "UK", client: "UK Audit", multiTower: true, industry: "Audit", los: "UK Tech Catalyst",
    team: [["Ziad Helmy", 50]] },

  // FY27 work in flight
  { name: "Audit Analytics Program – Phase 3 Analytics", capability: ["BA", "PO"], status: "ACTIVE", rag: "AMBER", start: "2026-07-06", end: "2027-03-31", territory: "UK", client: "UK Audit", multiTower: true, industry: "Audit", los: "UK Tech Catalyst",
    scope: "Self-service analytics and evidence dashboards for engagement teams, replacing manual report packs.",
    team: [["Ziad Helmy", 60], ["Rana Zaki", 50], ["Mostafa Galal", 30]], risks: [["Data lineage from legacy audit tools is incomplete", "HIGH"], ["Engagement team availability for UAT during busy season", "MEDIUM"]] },
  { name: "Family Services – Hypercare", capability: ["PM"], status: "ACTIVE", rag: "GREEN", start: "2026-08-17", end: "2026-12-18", territory: "ME", client: "Relecloud Community Services", multiTower: false, industry: "Social Sector", los: "ME D&C – FS",
    team: [["Nour El Sayed", 60], ["Sherif Kamal", 20]] },
  { name: "Student Funding Scheme – Digital Platform", capability: ["PM", "BA", "SD"], status: "ACTIVE", rag: "RED", start: "2026-09-01", end: "2027-04-30", territory: "ME", client: "Lucerne Education Authority", multiTower: true, industry: "Education", los: "ME Operate",
    scope: "Design and mobilise the digital platform for the private university student funding scheme: applicant journey, eligibility rules and lender integration.",
    team: [["Farida Lotfy", 100], ["Habiba Naguib", 80], ["Youssef Nabil", 50], ["Sherif Kamal", 30]],
    risks: [["Investor engagement: private-sector funding commitments not yet secured", "CRITICAL"], ["Compressed timeline between mobilisation and proposal submission", "HIGH"]] },
  { name: "Humongous Insurance – Digital Roadmap Mobilisation", capability: ["PdM", "BA"], status: "PIPELINE", rag: "GREEN", start: "2026-11-02", end: "2027-03-26", territory: "UK", client: "Humongous Insurance", multiTower: false, industry: "Financial Services", los: "UK Risk",
    team: [["Mostafa Galal", 100], ["Tarek Fawzy", 50]] },
  { name: "Intake & Utilization Portal", capability: ["PdM", "PD"], status: "ACTIVE", rag: "GREEN", start: "2026-09-14", end: "2027-01-29", territory: "UK", client: "Firm Internal", multiTower: false, industry: "Internal Services", los: "UK Tech Catalyst",
    scope: "Replace the shared utilization spreadsheet with a governed portal: SSO, audit trail, capacity planning and reporting.",
    team: [["Portal Admin", 40], ["Yasmin Saber", 30], ["Seif Badawi", 50]] },
  { name: "Contoso – Open Banking Discovery", capability: ["BA", "SD"], status: "PIPELINE", rag: "AMBER", start: "2026-11-16", end: "2027-02-12", territory: "ME", client: "Contoso Bank", multiTower: true, industry: "Financial Services", los: "ME D&C – FS",
    team: [["Omar Farouk", 100], ["Habiba Naguib", 50]] },
  { name: "Deals Insight Hub", capability: ["PO", "PD"], status: "ON_HOLD", rag: "AMBER", start: "2026-07-20", end: "2026-12-11", territory: "UK", client: "UK Deals", multiTower: false, industry: "Deals", los: "UK Tech Catalyst",
    team: [["Salma Ibrahim", 50], ["Khaled Ramzy", 60]], risks: [["Sponsor change paused funding decision", "HIGH"]] },
];

async function main() {
  if (IF_EMPTY && (await db.user.count()) > 0) {
    console.log("Database already has users; demo seed skipped.");
    return;
  }
  console.log("Seeding…");
  await db.$transaction([
    db.auditLog.deleteMany(), db.projectUpdate.deleteMany(), db.risk.deleteMany(), db.assignment.deleteMany(),
    db.project.deleteMany(), db.person.deleteMany(), db.client.deleteMany(), db.lineOfService.deleteMany(),
    db.industry.deleteMany(), db.capability.deleteMany(), db.territory.deleteMany(),
    db.session.deleteMany(), db.account.deleteMany(), db.user.deleteMany(), db.rateLimit.deleteMany(),
  ]);

  const territory = Object.fromEntries(
    await Promise.all(TERRITORIES.map(async (t) => [t.code, (await db.territory.create({ data: t })).id] as const)),
  );
  const capability = Object.fromEntries(
    await Promise.all(CAPABILITIES.map(async (c) => [c.code, (await db.capability.create({ data: c })).id] as const)),
  );
  const industry = Object.fromEntries(
    await Promise.all(INDUSTRIES.map(async (name) => [name, (await db.industry.create({ data: { name } })).id] as const)),
  );
  const los = Object.fromEntries(
    await Promise.all(
      LINES_OF_SERVICE.map(async (l) => [l.name, (await db.lineOfService.create({ data: { name: l.name, territoryId: territory[l.territory] } })).id] as const),
    ),
  );
  const client = Object.fromEntries(
    await Promise.all(
      CLIENTS.map(async (c) => [c.name, (await db.client.create({ data: { name: c.name, industryId: industry[c.industry], isInternal: !!c.internal } })).id] as const),
    ),
  );

  // Dev personas (email/password, dev sign-in only)
  const devPassword = process.env.AUTH_DEV_PASSWORD;
  if (!devPassword || devPassword.length < 12) throw new Error("Set AUTH_DEV_PASSWORD (12+ chars) in .env before seeding.");
  const hash = await hashPassword(devPassword);
  // One admin and two employees whose resource records have real assignments.
  const personas = [
    { email: "admin@pwc.com", name: "Portal Admin", role: "ADMIN" as const },
    { email: "rana.zaki@pwc.com", name: "Rana Zaki", role: "EMPLOYEE" as const },
    { email: "farida.lotfy@pwc.com", name: "Farida Lotfy", role: "EMPLOYEE" as const },
  ];
  const users: Record<string, string> = {};
  for (const p of personas) {
    const u = await db.user.create({ data: { email: p.email, name: p.name, role: p.role, emailVerified: true } });
    await db.account.create({ data: { userId: u.id, accountId: u.id, providerId: "credential", password: hash } });
    users[p.email] = u.id;
  }

  const person: Record<string, string> = {};
  for (const p of PEOPLE) {
    const slug = p.name.toLowerCase().replace(/[^a-z]+/g, ".");
    const email = p.email ?? `${slug}@pwc.com`;
    const created = await db.person.create({
      data: {
        name: p.name,
        email,
        grade: p.grade,
        territoryId: territory[p.territory],
        primaryCapabilityId: capability[p.capability],
        userId: users[email],
      },
    });
    person[p.name] = created.id;
  }

  const editorId = users["rana.zaki@pwc.com"];
  for (const p of PROJECTS) {
    const start = d(p.start);
    const end = p.end ? d(p.end) : null;
    const project = await db.project.create({
      data: {
        name: p.name,
        clientId: client[p.client],
        industryId: industry[p.industry],
        lineOfServiceId: los[p.los],
        territoryId: territory[p.territory],
        status: p.status,
        rag: p.rag,
        startDate: start,
        endDate: end,
        multiTower: p.multiTower,
        engagementLeads: [pick(LEADS), ...(rand() > 0.6 ? [pick(LEADS)] : [])].filter((v, i, a) => a.indexOf(v) === i),
        scope: p.scope,
        createdById: editorId,
        updatedById: editorId,
      },
    });

    for (const [i, [name, allocation]] of p.team.entries()) {
      await db.assignment.create({
        data: {
          projectId: project.id,
          personId: person[name],
          capabilityId: capability[p.capability[Math.min(i, p.capability.length - 1)]],
          allocation,
          startDate: start,
          endDate: end,
        },
      });
    }

    for (const [title, severity] of p.risks ?? []) {
      await db.risk.create({
        data: {
          projectId: project.id,
          title,
          severity,
          status: p.status === "CLOSED" ? "CLOSED" : rand() > 0.5 ? "OPEN" : "MITIGATING",
          owner: pick(LEADS),
          createdById: editorId,
        },
      });
    }

    if (p.status === "ACTIVE" || p.status === "ON_HOLD") {
      const notes = [
        "Sprint review completed; backlog re-prioritised with the client product owner.",
        "Stakeholder workshops finished. Requirements baseline signed off.",
        "Dependency on client data team flagged in the steering committee.",
      ];
      for (let i = 0; i < 2; i++) {
        await db.projectUpdate.create({
          data: {
            projectId: project.id,
            authorId: editorId,
            rag: i === 0 ? p.rag : "GREEN",
            body: notes[(i + p.name.length) % notes.length],
            createdAt: new Date(Date.now() - (i * 14 + 2) * 86_400_000),
          },
        });
      }
    }
  }

  await db.auditLog.create({
    data: { actorId: users["admin@pwc.com"], action: "system.seed", entityType: "system", summary: "Development data seeded" },
  });

  const counts = await Promise.all([db.project.count(), db.person.count(), db.assignment.count(), db.risk.count()]);
  console.log(`Done: ${counts[0]} projects, ${counts[1]} people, ${counts[2]} assignments, ${counts[3]} risks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
