import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, History, Layers, MessageSquare, Pencil, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAdmin, projectScope } from "@/lib/access";
import { getProject } from "@/lib/queries/projects";
import { getReferenceData } from "@/lib/queries/reference";
import { GRADE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, EmptyState } from "@/components/ui/panel";
import { Badge, RagBadge, RiskStatusBadge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn, formatDate, formatDateTime, projectRef, relativeTime, toDateInput, initials } from "@/lib/utils";
import {
  AssignmentDialog,
  DeleteProjectButton,
  DeleteRiskButton,
  RemoveAssignmentButton,
  RiskDialog,
  UpdateForm,
} from "./project-editors";

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const p = await db.project.findFirst({ where: { id, deletedAt: null, ...projectScope(user) }, select: { name: true } });
  return { title: p?.name ?? "Project" };
}

const TABS = [
  { id: "overview", label: "Overview", icon: null },
  { id: "team", label: "Team", icon: Users },
  { id: "risks", label: "Risks", icon: AlertTriangle },
  { id: "updates", label: "Status updates", icon: MessageSquare },
  { id: "history", label: "History", icon: History },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const admin = isAdmin(user);
  // History includes teammates' allocation changes, so it is admin-only.
  const tabs = TABS.filter((t) => admin || t.id !== "history");
  const tab: TabId = (tabs.find((t) => t.id === sp.tab)?.id ?? "overview") as TabId;

  // Employees only reach projects they're on; anything else is a 404.
  const project = await getProject(id, user);
  if (!project) notFound();
  const canEdit = true; // admins, or an employee assigned to this project (enforced by getProject + actions)
  const isMine = (personId: string) => personId === user.personId;
  const myCapabilityId = project.assignments.find((a) => isMine(a.personId))?.capabilityId ?? null;

  const openRisks = project.risks.filter((r) => r.status !== "CLOSED");
  const durationWeeks = project.endDate
    ? Math.max(1, Math.round((project.endDate.getTime() - project.startDate.getTime()) / (7 * 86_400_000)))
    : null;

  const [ref, history] = await Promise.all([
    canEdit && (tab === "team" || tab === "overview") ? getReferenceData() : Promise.resolve(null),
    tab === "history"
      ? db.auditLog.findMany({
          where: { entityType: "project", entityId: project.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { actor: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const counts: Partial<Record<TabId, number>> = {
    team: project.assignments.length,
    risks: openRisks.length,
    updates: project.updates.length,
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: admin ? "Projects" : "My projects", href: "/projects" }, { label: projectRef(project.number) }]}
        title={project.name}
        description={`${project.client.name}${project.lineOfService ? ` · ${project.lineOfService.name}` : ""} · ${project.territory.name}`}
        meta={
          <>
            <StatusBadge status={project.status} />
            <RagBadge rag={project.rag} />
            {project.multiTower && (
              <Badge tone="info">
                <Layers className="size-3" aria-hidden /> Multi-tower
              </Badge>
            )}
            <span className="tabular text-xs text-muted">{projectRef(project.number)}</span>
          </>
        }
        actions={
          canEdit && (
            <>
              {admin && <DeleteProjectButton projectId={project.id} name={project.name} />}
              <ButtonLink href={`/projects/${project.id}/edit`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit project
              </ButtonLink>
            </>
          )
        }
      />

      <div className="border-b border-line bg-container px-4 sm:px-8">
        <nav aria-label="Project sections" className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.id === "overview" ? `/projects/${project.id}` : `/projects/${project.id}?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              scroll={false}
              className={cn(
                "flex h-12 items-center gap-2 border-b-2 text-sm whitespace-nowrap transition-colors",
                tab === t.id ? "border-primary font-medium text-heading" : "border-transparent text-muted hover:text-heading",
              )}
            >
              {t.label}
              {counts[t.id] !== undefined && (
                <span className="tabular rounded-full bg-container-alt px-1.5 text-xs text-body">{counts[t.id]}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <PageBody className="flex flex-col gap-6">
        {sp.created && <FormAlert tone="success">Project created. Add the team below to start tracking utilization.</FormAlert>}
        {sp.saved && <FormAlert tone="success">Changes saved.</FormAlert>}

        {tab === "overview" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="flex flex-col gap-6 xl:col-span-2">
              <Panel>
                <PanelHeader title="Details" />
                <PanelBody>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Fact label="Client" value={project.client.name} />
                    <Fact label="Industry" value={project.industry?.name ?? "—"} />
                    <Fact label="Territory" value={project.territory.name} />
                    <Fact label="Line of service" value={project.lineOfService?.name ?? "—"} />
                    <Fact label="Start date" value={formatDate(project.startDate)} />
                    <Fact
                      label="End date"
                      value={`${formatDate(project.endDate)}${durationWeeks ? ` · ${durationWeeks} weeks` : ""}`}
                    />
                    <Fact
                      label="Engagement leads"
                      value={project.engagementLeads.length ? project.engagementLeads.join(", ") : "—"}
                      className="sm:col-span-2"
                    />
                    <Fact label="Multi-tower" value={project.multiTower ? "Yes" : "No"} />
                  </dl>
                </PanelBody>
              </Panel>
              <Panel>
                <PanelHeader title="Scope" />
                <PanelBody>
                  {project.scope ? (
                    <p className="text-sm leading-6 whitespace-pre-line text-body">{project.scope}</p>
                  ) : (
                    <p className="text-sm text-muted">No scope recorded yet.</p>
                  )}
                </PanelBody>
              </Panel>
            </div>

            <div className="flex flex-col gap-6">
              <Panel>
                <PanelHeader
                  title="Team"
                  actions={
                    <Link href={`/projects/${project.id}?tab=team`} className="text-sm text-primary hover:underline">
                      Manage
                    </Link>
                  }
                />
                {project.assignments.length === 0 ? (
                  <EmptyState title="No one is assigned yet" className="py-8" />
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {project.assignments.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-6 py-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-container-alt text-xs font-medium text-body">
                          {initials(a.person.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <PersonName admin={admin} id={a.person.id} name={a.person.name} you={isMine(a.personId)} className="block truncate text-sm" />
                          <p className="truncate text-xs text-muted">{a.capability?.name ?? "—"}</p>
                        </div>
                        <span className="tabular text-sm text-heading">{admin || isMine(a.personId) ? `${a.allocation}%` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel>
                <PanelHeader
                  title="Open risks"
                  actions={
                    <Link href={`/projects/${project.id}?tab=risks`} className="text-sm text-primary hover:underline">
                      View all
                    </Link>
                  }
                />
                {openRisks.length === 0 ? (
                  <EmptyState title="No open risks" className="py-8" />
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {openRisks.slice(0, 4).map((r) => (
                      <li key={r.id} className="flex items-start gap-3 px-6 py-3">
                        <p className="flex-1 text-sm text-body">{r.title}</p>
                        <SeverityBadge severity={r.severity} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {project.updates[0] && (
                <Panel>
                  <PanelHeader title="Latest update" description={`${project.updates[0].author?.name ?? "Unknown"} · ${relativeTime(project.updates[0].createdAt)}`} />
                  <PanelBody>
                    <p className="text-sm leading-6 text-body">{project.updates[0].body}</p>
                  </PanelBody>
                </Panel>
              )}
              <p className="px-1 text-xs text-muted">
                Created {project.createdBy ? `by ${project.createdBy.name} ` : ""}on {formatDate(project.createdAt)} · last updated{" "}
                {relativeTime(project.updatedAt)}
                {project.updatedBy ? ` by ${project.updatedBy.name}` : ""}
              </p>
            </div>
          </div>
        )}

        {tab === "team" && (
          <Panel>
            <PanelHeader
              title="Team assignments"
              description={
                admin
                  ? "Each assignment books a share of the person's capacity for a date range."
                  : "You can change your own assignment. Teammates' allocation is only visible to admins."
              }
              actions={
                ref && (
                  <AssignmentDialog
                    projectId={project.id}
                    people={admin ? ref.people : []}
                    capabilities={ref.capabilities}
                    selfOnly={!admin}
                    defaults={{ startDate: toDateInput(project.startDate), endDate: toDateInput(project.endDate), capabilityId: myCapabilityId }}
                  />
                )
              }
            />
            {project.assignments.length === 0 ? (
              <EmptyState icon={<Users className="size-5" />} title="No one is assigned yet" description="Add team members to track their utilization." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Person</Th>
                    <Th>Capability</Th>
                    <Th className="text-right">Allocation</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Note</Th>
                    <Th className="w-24"><span className="sr-only">Actions</span></Th>
                  </tr>
                </THead>
                <tbody>
                  {project.assignments.map((a) => {
                    const visible = admin || isMine(a.personId);
                    return (
                    <Tr key={a.id} className={isMine(a.personId) && !admin ? "bg-primary-tint/40" : undefined}>
                      <Td>
                        <PersonName admin={admin} id={a.person.id} name={a.person.name} you={isMine(a.personId)} className="font-medium" />
                        {a.person.grade && <p className="text-xs text-muted">{GRADE_LABEL[a.person.grade]}</p>}
                      </Td>
                      <Td>{a.capability?.name ?? "—"}</Td>
                      <Td className="tabular text-right font-medium text-heading">{visible ? `${a.allocation}%` : "—"}</Td>
                      <Td className="tabular whitespace-nowrap">{visible ? formatDate(a.startDate) : "—"}</Td>
                      <Td className="tabular whitespace-nowrap">{visible ? formatDate(a.endDate ?? project.endDate) : "—"}</Td>
                      <Td className="max-w-xs truncate text-muted">{a.note ?? ""}</Td>
                      <Td>
                      {visible && ref && (
                          <div className="flex justify-end gap-1">
                            <AssignmentDialog
                              projectId={project.id}
                              people={admin ? ref.people : []}
                              capabilities={ref.capabilities}
                              defaults={{ startDate: toDateInput(project.startDate), endDate: toDateInput(project.endDate) }}
                              selfOnly={!admin}
                              existing={{
                                id: a.id,
                                personId: a.personId,
                                capabilityId: a.capabilityId,
                                allocation: a.allocation,
                                startDate: toDateInput(a.startDate),
                                endDate: toDateInput(a.endDate),
                                note: a.note,
                              }}
                            />
                            <RemoveAssignmentButton projectId={project.id} assignmentId={a.id} name={isMine(a.personId) ? "yourself" : a.person.name} />
                          </div>
                      )}
                      </Td>
                    </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Panel>
        )}

        {tab === "risks" && (
          <Panel>
            <PanelHeader title="Risks & challenges" actions={canEdit && <RiskDialog projectId={project.id} />} />
            {project.risks.length === 0 ? (
              <EmptyState icon={<AlertTriangle className="size-5" />} title="No risks recorded" description="Raise risks early so they can be mitigated." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Risk</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                    <Th>Owner</Th>
                    <Th>Raised</Th>
                    {canEdit && <Th className="w-24"><span className="sr-only">Actions</span></Th>}
                  </tr>
                </THead>
                <tbody>
                  {project.risks.map((r) => (
                    <Tr key={r.id} className={r.status === "CLOSED" ? "opacity-60" : undefined}>
                      <Td className="max-w-xl py-3">
                        <p className="text-heading">{r.title}</p>
                        {r.mitigation && <p className="mt-1 text-xs text-muted">Mitigation: {r.mitigation}</p>}
                      </Td>
                      <Td>
                        <SeverityBadge severity={r.severity} />
                      </Td>
                      <Td>
                        <RiskStatusBadge status={r.status} />
                      </Td>
                      <Td>{r.owner ?? "—"}</Td>
                      <Td className="tabular whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                      {canEdit && (
                        <Td>
                          <div className="flex justify-end gap-1">
                            <RiskDialog
                              projectId={project.id}
                              existing={{ id: r.id, title: r.title, mitigation: r.mitigation, severity: r.severity, status: r.status, owner: r.owner }}
                            />
                            {(admin || r.createdById === user.id) && <DeleteRiskButton projectId={project.id} riskId={r.id} />}
                          </div>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        )}

        {tab === "updates" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {canEdit && (
              <Panel className="xl:order-2">
                <PanelHeader title="Post an update" description="Visible to admins and everyone on this project's team." />
                <PanelBody>
                  <UpdateForm projectId={project.id} currentRag={project.rag} />
                </PanelBody>
              </Panel>
            )}
            <Panel className={cn("xl:order-1", canEdit ? "xl:col-span-2" : "xl:col-span-3")}>
              <PanelHeader title="Timeline" />
              {project.updates.length === 0 ? (
                <EmptyState icon={<MessageSquare className="size-5" />} title="No updates yet" />
              ) : (
                <ol className="relative mx-6 mb-6 border-l border-line">
                  {project.updates.map((u) => (
                    <li key={u.id} className="relative pb-6 pl-6 last:pb-0">
                      <span className="absolute top-1 -left-[5px] size-2.5 rounded-full bg-primary ring-4 ring-container" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-heading">{u.author?.name ?? "Unknown"}</span>
                        <time className="text-xs text-muted" dateTime={u.createdAt.toISOString()} title={formatDateTime(u.createdAt)}>
                          {relativeTime(u.createdAt)}
                        </time>
                        <RagBadge rag={u.rag} />
                      </div>
                      <p className="mt-1.5 text-sm leading-6 whitespace-pre-line text-body">{u.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        )}

        {tab === "history" && (
          <Panel>
            <PanelHeader title="Change history" description="Every change to this project, its team and risks." />
            {history.length === 0 ? (
              <EmptyState icon={<History className="size-5" />} title="No changes recorded" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-start sm:gap-6">
                    <time className="tabular w-44 shrink-0 text-xs text-muted" dateTime={h.createdAt.toISOString()}>
                      {formatDateTime(h.createdAt)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-heading">
                        <span className="font-medium">{h.actor?.name ?? "System"}</span> — {h.summary}
                      </p>
                      <ChangeList changes={h.changes} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </PageBody>
    </>
  );
}

function Fact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-heading">{value}</dd>
    </div>
  );
}

function ChangeList({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== "object") return null;
  const entries = Object.entries(changes as Record<string, { from?: unknown; to?: unknown }>).filter(
    ([, v]) => v && typeof v === "object" && "to" in v,
  );
  if (entries.length === 0) return null;
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : Array.isArray(v) ? v.join(", ") || "—" : String(v));
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
      {entries.slice(0, 8).map(([k, v]) => (
        <li key={k}>
          <span className="text-body">{k}</span>: <span className="line-through">{show(v.from)}</span> → <span className="text-heading">{show(v.to)}</span>
        </li>
      ))}
    </ul>
  );
}

function PersonName({ admin, id, name, you, className }: { admin: boolean; id: string; name: string; you: boolean; className?: string }) {
  const label = (
    <>
      {name}
      {you && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
    </>
  );
  // Person pages hold team-wide utilization, so only admins get the link.
  return admin ? (
    <Link href={`/people/${id}`} className={cn("text-heading hover:text-primary hover:underline", className)}>
      {label}
    </Link>
  ) : (
    <span className={cn("text-heading", className)}>{label}</span>
  );
}
