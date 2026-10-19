import type { Metadata } from "next";
import Link from "next/link";
import { Download, FolderKanban, Layers, Plus, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/access";
import { fiscalYear, fiscalYearOf } from "@/lib/domain/fiscal-year";
import { listProjects, PAGE_SIZE, parseProjectFilters, type ProjectFilters } from "@/lib/queries/projects";
import { getReferenceData } from "@/lib/queries/reference";
import { RAG_LABEL, RAGS, STATUS_LABEL, STATUSES } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { Table, THead, Th, Tr, Td, SortTh } from "@/components/ui/table";
import { RagBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, projectRef } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

function toParams(f: ProjectFilters, overrides: Partial<Record<keyof ProjectFilters, string | number | undefined>> = {}) {
  const merged = { ...f, ...overrides } as Record<string, unknown>;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || v === null) continue;
    if (k === "page" && v === 1) continue;
    if (k === "sort" && v === "start" && merged.dir === "desc") continue;
    if (k === "dir" && v === "desc" && merged.sort === "start") continue;
    p.set(k, String(v));
  }
  return p.toString();
}

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const user = await requireUser();
  const filters = parseProjectFilters(await searchParams);
  const admin = isAdmin(user);
  const [{ rows, total, pages }, ref] = await Promise.all([listProjects(filters, user), getReferenceData()]);

  const currentFy = fiscalYearOf(new Date());
  const fyOptions = [currentFy.year + 1, currentFy.year, currentFy.year - 1, currentFy.year - 2].map((y) => {
    const fy = fiscalYear(y);
    return { value: fy.label, label: `${fy.label}${y === currentFy.year ? " (current)" : ""}` };
  });

  const href = (o: Partial<Record<keyof ProjectFilters, string | number | undefined>>) => {
    const qs = toParams(filters, o);
    return `/projects${qs ? `?${qs}` : ""}`;
  };
  const exportQs = toParams({ ...filters, page: 1 });

  return (
    <>
      <PageHeader
        title={admin ? "Projects" : "My projects"}
        description={
          admin
            ? "Every engagement with its team, dates, status and health. Defaults to projects running in the current fiscal year."
            : "The projects you're working on. Keep your allocation, risks and status up to date here."
        }
        actions={
          <>
            <a href={`/api/export/projects${exportQs ? `?${exportQs}` : ""}`} className={buttonClass("secondary")}>
              <Download className="size-4" aria-hidden /> Export to Excel
            </a>
            {!admin && (
              <ButtonLink href="/projects/join" variant="secondary">
                <UserPlus className="size-4" aria-hidden /> Join a project
              </ButtonLink>
            )}
            <ButtonLink href="/projects/new">
              <Plus className="size-4" aria-hidden /> {admin ? "New project" : "Log a project"}
            </ButtonLink>
          </>
        }
      />
      <PageBody className="flex flex-col gap-4">
        <FilterBar
          searchPlaceholder={admin ? "Search name, client, lead or person" : "Search your projects"}
          values={{ ...filters, page: undefined } as Record<string, string | undefined>}
          filters={[
            { name: "fy", label: "Fiscal year", noEmpty: true, options: [{ value: "all", label: "All years" }, ...fyOptions], defaultValue: currentFy.label },
            {
              name: "status",
              label: "Status",
              options: [{ value: "OPEN", label: "Open (not closed)" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))],
            },
            { name: "rag", label: "RAG", options: RAGS.map((r) => ({ value: r, label: RAG_LABEL[r] })) },
            ...(admin
              ? [
                  { name: "territory", label: "Territory", options: ref.territories.map((t) => ({ value: t.code, label: t.name })) },
                  { name: "los", label: "Line of service", options: ref.linesOfService.map((l) => ({ value: l.id, label: l.name })) },
                  { name: "capability", label: "Capability", options: ref.capabilities.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })) },
                ]
              : []),
          ]}
        />

        <Panel>
          {rows.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="size-5" />}
              title={admin ? "No projects match these filters" : "No projects here yet"}
              description={
                admin ? "Try another fiscal year or clear the filters." : "Log a project you're working on, or join one a colleague has already added."
              }
              action={
                admin ? (
                  <Link href="/projects?fy=all" className="text-sm text-primary hover:underline">
                    Show all fiscal years
                  </Link>
                ) : (
                  <div className="flex gap-3">
                    <ButtonLink href="/projects/join" variant="secondary">
                      Join a project
                    </ButtonLink>
                    <ButtonLink href="/projects/new">Log a project</ButtonLink>
                  </div>
                )
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <SortTh label="Project" column="name" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                    <SortTh label="Client" column="client" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                    <Th>{admin ? "Team" : "Your allocation"}</Th>
                    <SortTh label="Start" column="start" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                    <SortTh label="End" column="end" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                    <SortTh label="Status" column="status" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                    <SortTh label="RAG" column="rag" sort={filters.sort} dir={filters.dir} hrefFor={(c, d) => href({ sort: c, dir: d, page: 1 })} />
                  </tr>
                </THead>
                <tbody>
                  {rows.map((p) => {
                    const caps = Array.from(new Set(p.assignments.map((a) => a.capability?.code).filter(Boolean)));
                    return (
                      <Tr key={p.id}>
                        <Td className="max-w-[26rem] min-w-[18rem]">
                          <Link href={`/projects/${p.id}`} className="font-medium text-heading hover:text-primary hover:underline">
                            {p.name}
                          </Link>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            <span className="tabular">{projectRef(p.number)}</span>
                            <span aria-hidden>·</span>
                            <span>{p.territory.code}</span>
                            {p.lineOfService && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{p.lineOfService.name}</span>
                              </>
                            )}
                            {caps.length > 0 && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{caps.join(", ")}</span>
                              </>
                            )}
                            {p.multiTower && (
                              <span className="inline-flex items-center gap-1 text-info" title="Multi-tower engagement">
                                <Layers className="size-3" aria-hidden /> Multi-tower
                              </span>
                            )}
                            {p._count.risks > 0 && <span className="text-error">{p._count.risks} open risk{p._count.risks > 1 && "s"}</span>}
                          </p>
                        </Td>
                        <Td className="min-w-[12rem]">
                          <span className="text-heading">{p.client.name}</span>
                          {p.industry && <p className="text-xs text-muted">{p.industry.name}</p>}
                        </Td>
                        <Td className="min-w-[12rem]">
                          {!admin ? (
                            <MyAllocation assignments={p.assignments} personId={user.personId} />
                          ) : p.assignments.length === 0 ? (
                            <span className="text-muted">Unstaffed</span>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {p.assignments.slice(0, 3).map((a, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                                  <Link href={`/people/${a.person.id}`} className="truncate hover:text-primary hover:underline">
                                    {a.person.name}
                                  </Link>
                                  <span className="tabular text-xs text-muted">{a.allocation}%</span>
                                </li>
                              ))}
                              {p.assignments.length > 3 && <li className="text-xs text-muted">+{p.assignments.length - 3} more</li>}
                            </ul>
                          )}
                        </Td>
                        <Td className="tabular whitespace-nowrap">{formatDate(p.startDate)}</Td>
                        <Td className="tabular whitespace-nowrap">{formatDate(p.endDate)}</Td>
                        <Td>
                          <StatusBadge status={p.status} />
                        </Td>
                        <Td>
                          <RagBadge rag={p.rag} />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={filters.page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={(n) => href({ page: n })} />
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}

/** Employees see their own allocation and a teammate count, never teammates' allocation. */
function MyAllocation({ assignments, personId }: { assignments: { personId: string; allocation: number }[]; personId: string | null }) {
  const mine = assignments.filter((a) => a.personId === personId);
  const others = new Set(assignments.filter((a) => a.personId !== personId).map((a) => a.personId)).size;
  return (
    <div>
      <span className="tabular font-medium text-heading">{mine.map((a) => `${a.allocation}%`).join(" + ") || "—"}</span>
      {others > 0 && <p className="text-xs text-muted">with {others} teammate{others === 1 ? "" : "s"}</p>}
    </div>
  );
}
