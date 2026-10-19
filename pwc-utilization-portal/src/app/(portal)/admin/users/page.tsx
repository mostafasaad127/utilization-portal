import type { Metadata } from "next";
import { Info, MailPlus } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import { ENTRA_APP_ROLES } from "@/lib/auth-policy";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { UserControls } from "./user-controls";
import { AddUserDialog, RevokeInvitationButton } from "./add-user-dialog";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const admin = await requireRole("ADMIN");
  const [users, invitations, territories, capabilities] = await Promise.all([
    db.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
      },
    }),
    db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    }),
    db.territory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.capability.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Who can sign in and what they can see. Add people ahead of their first sign-in, change roles, or revoke access."
        actions={<AddUserDialog territories={territories} capabilities={capabilities} allowedDomains={env.allowedDomains} />}
      />
      <PageBody className="flex flex-col gap-6">
        <Panel>
          <PanelBody className="flex gap-3 pt-5 text-sm">
            <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
            <div className="flex flex-col gap-2 text-body">
              {env.rolesFromEntra ? (
                <p>
                  Roles come from Microsoft Entra ID app roles and are re-synced at every sign-in (
                  {Object.entries(ENTRA_APP_ROLES)
                    .map(([k, v]) => `${k} → ${ROLE_LABEL[v]}`)
                    .join(", ")}
                  ; no app role → Employee). Changes made here last until the user&apos;s next sign-in; manage group membership in Entra for
                  lasting changes.
                </p>
              ) : (
                <p>
                  Roles are managed here. Anyone with a PwC account {env.inviteOnly ? "who has been added below" : ""} can sign in and joins
                  as an Employee, unless you added them in advance with a different role.
                </p>
              )}
              {env.inviteOnly && <p className="font-medium text-heading">Invite-only mode is on: people must be added here before they can sign in.</p>}
              <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
                {(["ADMIN", "EMPLOYEE"] as const).map((r) => (
                  <li key={r}>
                    <span className="font-medium text-heading">{ROLE_LABEL[r]}</span> — {ROLE_DESCRIPTION[r]}
                  </li>
                ))}
              </ul>
            </div>
          </PanelBody>
        </Panel>

        {invitations.length > 0 && (
          <Panel>
            <PanelHeader
              title={`Waiting for first sign-in (${invitations.length})`}
              description="Added by an admin. They get the role shown when they first sign in with PwC SSO."
              actions={<MailPlus className="size-5 text-muted" aria-hidden />}
            />
            <Table>
              <THead>
                <tr>
                  <Th>Person</Th>
                  <Th>Role on first sign-in</Th>
                  <Th>Added</Th>
                  <Th className="w-16">
                    <span className="sr-only">Revoke</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {invitations.map((i) => (
                  <Tr key={i.id}>
                    <Td className="min-w-[16rem]">
                      <p className="font-medium text-heading">{i.name}</p>
                      <p className="text-xs text-muted">{i.email}</p>
                    </Td>
                    <Td>
                      <Badge tone={i.role === "ADMIN" ? "primary" : "neutral"}>{ROLE_LABEL[i.role]}</Badge>
                    </Td>
                    <Td className="text-sm whitespace-nowrap" title={formatDateTime(i.createdAt)}>
                      {relativeTime(i.createdAt)}
                      {i.invitedBy && <span className="text-muted"> by {i.invitedBy.name}</span>}
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <RevokeInvitationButton id={i.id} email={i.email} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}

        <Panel>
          <PanelHeader title={`${users.length} users`} description="People who have signed in at least once." />
          <Table>
            <THead>
              <tr>
                <Th>User</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th>Active sessions</Th>
                <Th className="text-right">Role & access</Th>
              </tr>
            </THead>
            <tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td className="min-w-[16rem]">
                    <p className="font-medium text-heading">
                      {u.name} {u.id === admin.id && <span className="text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </Td>
                  <Td>{u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="error">Revoked</Badge>}</Td>
                  <Td className="whitespace-nowrap" title={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined}>
                    {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never"}
                  </Td>
                  <Td className="tabular">{u._count.sessions}</Td>
                  <Td>
                    <UserControls userId={u.id} role={u.role} isActive={u.isActive} isSelf={u.id === admin.id} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </PageBody>
    </>
  );
}
