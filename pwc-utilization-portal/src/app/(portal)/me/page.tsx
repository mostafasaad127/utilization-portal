import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { myPersonId } from "@/lib/access";
import { ROLE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const user = await requireUser();
  const personId = await myPersonId(user);
  const [person, territories, capabilities] = await Promise.all([
    db.person.findUniqueOrThrow({ where: { id: personId }, select: { grade: true, territoryId: true, primaryCapabilityId: true } }),
    db.territory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.capability.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="My profile" description="How you appear in the resource pool. Your name and email come from PwC single sign-on." />
      <PageBody className="flex max-w-4xl flex-col gap-6">
        <Panel>
          <PanelHeader title="Account" />
          <PanelBody>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Name</dt>
                <dd className="mt-1 text-sm text-heading">{user.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Email</dt>
                <dd className="mt-1 text-sm text-heading">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Portal role</dt>
                <dd className="mt-1">
                  <Badge>{ROLE_LABEL[user.role]}</Badge>
                </dd>
              </div>
            </dl>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Resource details" />
          <PanelBody>
            <ProfileForm defaults={person} territories={territories} capabilities={capabilities} />
          </PanelBody>
        </Panel>
      </PageBody>
    </>
  );
}
