import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { GRADE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AddReferenceForm, ArchiveToggle, PersonDialog } from "./reference-controls";

export const metadata: Metadata = { title: "Reference data" };

const TABS = [
  { id: "people", label: "Resource pool" },
  { id: "clients", label: "Clients" },
  { id: "industries", label: "Industries" },
  { id: "los", label: "Lines of service" },
  { id: "capabilities", label: "Capabilities" },
] as const;

export default async function ReferencePage({ searchParams }: PageProps<"/admin/reference">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "people";

  const [territories, capabilities, industries] = await Promise.all([
    db.territory.findMany({ orderBy: { code: "asc" } }),
    db.capability.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { assignments: true } } } }),
    db.industry.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { projects: true } } } }),
  ]);
  const activeCaps = capabilities.filter((c) => c.isActive);

  return (
    <>
      <PageHeader title="Reference data" description="Lists that drive the forms and filters. Archive rather than delete so history stays intact." />
      <div className="border-b border-line bg-container px-4 sm:px-8">
        <nav aria-label="Reference data" className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/admin/reference?tab=${t.id}`}
              scroll={false}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex h-12 items-center border-b-2 text-sm whitespace-nowrap",
                tab === t.id ? "border-primary font-medium text-heading" : "border-transparent text-muted hover:text-heading",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <PageBody className="flex flex-col gap-6">
        {tab === "people" && <PeopleTab territories={territories} capabilities={activeCaps} />}

        {tab === "clients" && <ClientsTab industries={industries.filter((i) => i.isActive)} />}

        {tab === "industries" && (
          <Panel>
            <PanelHeader title="Industries" />
            <PanelBody>
              <AddReferenceForm kind="industry" />
            </PanelBody>
            <SimpleTable
              kind="industry"
              rows={industries.map((i) => ({ id: i.id, cells: [i.name, String(i._count.projects)], isActive: i.isActive }))}
              headers={["Name", "Projects"]}
            />
          </Panel>
        )}

        {tab === "los" && <LosTab territories={territories} />}

        {tab === "capabilities" && (
          <Panel>
            <PanelHeader title="Capabilities" description="Practice areas used on assignments, e.g. Business Analysis." />
            <PanelBody>
              <AddReferenceForm kind="capability" />
            </PanelBody>
            <SimpleTable
              kind="capability"
              rows={capabilities.map((c) => ({ id: c.id, cells: [c.code, c.name, String(c._count.assignments)], isActive: c.isActive }))}
              headers={["Code", "Name", "Assignments"]}
            />
          </Panel>
        )}
      </PageBody>
    </>
  );
}

async function PeopleTab({ territories, capabilities }: { territories: { id: string; name: string }[]; capabilities: { id: string; name: string }[] }) {
  const people = await db.person.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { territory: true, primaryCapability: true, user: { select: { id: true } } },
  });
  return (
    <Panel>
      <PanelHeader
        title="Resource pool"
        description="People who can be staffed on projects."
        actions={<PersonDialog territories={territories} capabilities={capabilities} />}
      />
      <Table>
        <THead>
          <tr>
            <Th>Name</Th>
            <Th>Email</Th>
            <Th>Grade</Th>
            <Th>Territory</Th>
            <Th>Capability</Th>
            <Th>Portal login</Th>
            <Th className="w-24">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </THead>
        <tbody>
          {people.map((p) => (
            <Tr key={p.id} className={p.isActive ? undefined : "opacity-55"}>
              <Td className="font-medium text-heading">
                {p.name} {!p.isActive && <Badge className="ml-2">Archived</Badge>}
              </Td>
              <Td className="text-muted">{p.email ?? "—"}</Td>
              <Td>{p.grade ? GRADE_LABEL[p.grade] : "—"}</Td>
              <Td>{p.territory?.code ?? "—"}</Td>
              <Td>{p.primaryCapability?.name ?? "—"}</Td>
              <Td>{p.user ? <Badge tone="success">Linked</Badge> : <span className="text-muted">—</span>}</Td>
              <Td>
                <div className="flex justify-end gap-1">
                  <PersonDialog
                    territories={territories}
                    capabilities={capabilities}
                    existing={{ id: p.id, name: p.name, email: p.email, grade: p.grade, territoryId: p.territoryId, primaryCapabilityId: p.primaryCapabilityId }}
                  />
                  <ArchiveToggle kind="person" id={p.id} isActive={p.isActive} />
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

async function ClientsTab({ industries }: { industries: { id: string; name: string }[] }) {
  const clients = await db.client.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { industry: true, _count: { select: { projects: { where: { deletedAt: null } } } } },
  });
  return (
    <Panel>
      <PanelHeader title="Clients" />
      <PanelBody>
        <AddReferenceForm kind="client" industries={industries} />
      </PanelBody>
      <SimpleTable
        kind="client"
        rows={clients.map((c) => ({ id: c.id, cells: [c.name, c.industry?.name ?? "—", String(c._count.projects)], isActive: c.isActive }))}
        headers={["Name", "Industry", "Projects"]}
      />
    </Panel>
  );
}

async function LosTab({ territories }: { territories: { id: string; name: string }[] }) {
  const los = await db.lineOfService.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { territory: true, _count: { select: { projects: true } } },
  });
  return (
    <Panel>
      <PanelHeader title="Lines of service" />
      <PanelBody>
        <AddReferenceForm kind="lineOfService" territories={territories} />
      </PanelBody>
      <SimpleTable
        kind="lineOfService"
        rows={los.map((l) => ({ id: l.id, cells: [l.name, l.territory.name, String(l._count.projects)], isActive: l.isActive }))}
        headers={["Name", "Territory", "Projects"]}
      />
    </Panel>
  );
}

function SimpleTable({
  kind,
  headers,
  rows,
}: {
  kind: "client" | "industry" | "lineOfService" | "capability";
  headers: string[];
  rows: { id: string; cells: string[]; isActive: boolean }[];
}) {
  return (
    <Table>
      <THead>
        <tr>
          {headers.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
          <Th className="w-16">
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </THead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id} className={r.isActive ? undefined : "opacity-55"}>
            {r.cells.map((c, i) => (
              <Td key={i} className={i === 0 ? "font-medium text-heading" : undefined}>
                {c}
                {i === 0 && !r.isActive && <Badge className="ml-2">Archived</Badge>}
              </Td>
            ))}
            <Td>
              <div className="flex justify-end">
                <ArchiveToggle kind={kind} id={r.id} isActive={r.isActive} />
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
