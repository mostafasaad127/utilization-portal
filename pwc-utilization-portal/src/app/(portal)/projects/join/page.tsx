import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FolderSearch } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAdmin, myPersonId } from "@/lib/access";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, toDateInput } from "@/lib/utils";
import { AssignmentDialog } from "../[id]/project-editors";

export const metadata: Metadata = { title: "Join a project" };

/**
 * Lets an employee add themselves to a project a colleague already logged,
 * instead of creating a duplicate. Only names, clients and dates of open
 * projects are listed — never who is on them or at what allocation.
 */
export default async function JoinProjectPage({ searchParams }: PageProps<"/projects/join">) {
  const user = await requireUser();
  if (isAdmin(user)) redirect("/projects"); // admins staff people from the project's Team tab
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100);
  const personId = await myPersonId(user);

  const [projects, capabilities, me] = await Promise.all([
    db.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "ON_HOLD", "PIPELINE"] },
        assignments: { none: { personId } },
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] } : {}),
      },
      orderBy: [{ startDate: "desc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        client: { select: { name: true } },
        lineOfService: { select: { name: true } },
      },
    }),
    db.capability.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.person.findUnique({ where: { id: personId }, select: { primaryCapabilityId: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Join a project"
        breadcrumbs={[{ label: "My projects", href: "/projects" }, { label: "Join a project" }]}
        description="Find a project a colleague already logged and add yourself to it. Can't find it? Log it as a new project."
        actions={<ButtonLink href="/projects/new" variant="secondary">Log a new project</ButtonLink>}
      />
      <PageBody className="flex flex-col gap-4">
        <FilterBar searchPlaceholder="Search by project or client" values={{ q }} filters={[]} />
        <Panel>
          {projects.length === 0 ? (
            <EmptyState
              icon={<FolderSearch className="size-5" />}
              title={q ? "No open projects match your search" : "No open projects to join"}
              description="If your project isn't listed, log it as a new project."
              action={<ButtonLink href="/projects/new">Log a project</ButtonLink>}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Project</Th>
                  <Th>Client</Th>
                  <Th>Dates</Th>
                  <Th>Status</Th>
                  <Th className="w-32">
                    <span className="sr-only">Join</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {projects.map((p) => (
                  <Tr key={p.id}>
                    <Td className="min-w-[16rem]">
                      <p className="font-medium text-heading">{p.name}</p>
                      {p.lineOfService && <p className="text-xs text-muted">{p.lineOfService.name}</p>}
                    </Td>
                    <Td>{p.client.name}</Td>
                    <Td className="tabular whitespace-nowrap">
                      {formatDate(p.startDate)} – {formatDate(p.endDate)}
                    </Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <AssignmentDialog
                          projectId={p.id}
                          people={[]}
                          capabilities={capabilities}
                          selfOnly
                          triggerLabel="Join"
                          defaults={{ startDate: toDateInput(p.startDate), endDate: toDateInput(p.endDate), capabilityId: me?.primaryCapabilityId }}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
