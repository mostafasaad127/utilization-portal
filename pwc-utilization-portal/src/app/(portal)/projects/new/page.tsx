import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { getReferenceData } from "@/lib/queries/reference";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  const [ref, me] = await Promise.all([
    getReferenceData(),
    user.personId ? db.person.findUnique({ where: { id: user.personId }, select: { primaryCapabilityId: true, territoryId: true } }) : null,
  ]);
  return (
    <>
      <PageHeader
        title={admin ? "New project" : "Log a project"}
        breadcrumbs={[{ label: admin ? "Projects" : "My projects", href: "/projects" }, { label: admin ? "New project" : "Log a project" }]}
        description={
          admin
            ? "Create the engagement first, then add the team and risks from the project page."
            : "Add a project you're working on. If a colleague already added it, join it instead so it isn't duplicated."
        }
      />
      <PageBody className="max-w-5xl">
        <ProjectForm
          action={createProject}
          options={{
            clients: ref.clients,
            industries: ref.industries,
            territories: ref.territories,
            linesOfService: ref.linesOfService,
          }}
          defaults={{ startDate: new Date().toISOString().slice(0, 10), territoryId: me?.territoryId ?? undefined }}
          involvement={{ required: !admin, capabilities: ref.capabilities, defaultCapabilityId: me?.primaryCapabilityId }}
          cancelHref="/projects"
          submitLabel={admin ? "Create project" : "Log project"}
        />
      </PageBody>
    </>
  );
}
