import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProject } from "@/lib/queries/projects";
import { getReferenceData } from "@/lib/queries/reference";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { toDateInput } from "@/lib/utils";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  // Employees can edit only projects they're assigned to; anything else is a 404.
  const [project, ref] = await Promise.all([getProject(id, user), getReferenceData()]);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${project.name}`}
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Edit" },
        ]}
      />
      <PageBody className="max-w-5xl">
        <ProjectForm
          action={updateProject.bind(null, project.id)}
          options={{
            clients: ref.clients,
            industries: ref.industries,
            territories: ref.territories,
            linesOfService: ref.linesOfService,
          }}
          defaults={{
            name: project.name,
            clientId: project.clientId,
            industryId: project.industryId,
            lineOfServiceId: project.lineOfServiceId,
            territoryId: project.territoryId,
            status: project.status,
            rag: project.rag,
            startDate: toDateInput(project.startDate),
            endDate: toDateInput(project.endDate),
            multiTower: project.multiTower,
            engagementLeads: project.engagementLeads,
            scope: project.scope,
          }}
          cancelHref={`/projects/${project.id}`}
          submitLabel="Save changes"
        />
      </PageBody>
    </>
  );
}
