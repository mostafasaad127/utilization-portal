import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FolderKanban, Search, User } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAdmin, projectScope } from "@/lib/access";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { RagBadge, StatusBadge } from "@/components/ui/badge";
import { GRADE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const user = await requireUser();
  const admin = isAdmin(user);
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) ?? "";

  const [projects, people, clients] = q
    ? await Promise.all([
        db.project.findMany({
          where: {
            deletedAt: null,
            ...projectScope(user),
            OR: [{ name: { contains: q, mode: "insensitive" } }, { scope: { contains: q, mode: "insensitive" } }],
          },
          take: 20,
          orderBy: { startDate: "desc" },
          select: { id: true, name: true, status: true, rag: true, startDate: true, client: { select: { name: true } } },
        }),
        // People and client lookups are admin-only.
        db.person.findMany({
          where: { isActive: true, ...(admin ? {} : { id: "__none__" }), OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
          take: 20,
          orderBy: { name: "asc" },
          select: { id: true, name: true, grade: true, primaryCapability: { select: { name: true } } },
        }),
        db.client.findMany({
          where: { name: { contains: q, mode: "insensitive" }, ...(admin ? {} : { id: "__none__" }) },
          take: 10,
          orderBy: { name: "asc" },
          select: { id: true, name: true, _count: { select: { projects: { where: { deletedAt: null } } } } },
        }),
      ])
    : [[], [], []];

  const total = projects.length + people.length + clients.length;

  return (
    <>
      <PageHeader title={q ? `Results for “${q}”` : "Search"} description={q ? `${total} result${total === 1 ? "" : "s"}` : undefined} />
      <PageBody className="flex flex-col gap-6">
        {!q || total === 0 ? (
          <Panel>
            <EmptyState
              icon={<Search className="size-5" />}
              title={q ? "Nothing matched your search" : "Search projects, clients and people"}
              description="Use the search box in the header."
            />
          </Panel>
        ) : (
          <>
            {projects.length > 0 && (
              <Panel>
                <PanelHeader title="Projects" />
                <ul className="divide-y divide-line border-t border-line">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-hover">
                        <FolderKanban className="size-4 text-muted" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-heading">{p.name}</p>
                          <p className="text-xs text-muted">
                            {p.client.name} · from {formatDate(p.startDate)}
                          </p>
                        </div>
                        <StatusBadge status={p.status} />
                        <RagBadge rag={p.rag} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {people.length > 0 && (
              <Panel>
                <PanelHeader title="People" />
                <ul className="divide-y divide-line border-t border-line">
                  {people.map((p) => (
                    <li key={p.id}>
                      <Link href={`/people/${p.id}`} className="flex items-center gap-4 px-6 py-3 hover:bg-hover">
                        <User className="size-4 text-muted" aria-hidden />
                        <span className="flex-1 text-sm font-medium text-heading">{p.name}</span>
                        <span className="text-xs text-muted">
                          {[p.grade && GRADE_LABEL[p.grade], p.primaryCapability?.name].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {clients.length > 0 && (
              <Panel>
                <PanelHeader title="Clients" />
                <ul className="divide-y divide-line border-t border-line">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <Link href={`/projects?client=${c.id}&fy=all`} className="flex items-center gap-4 px-6 py-3 hover:bg-hover">
                        <Building2 className="size-4 text-muted" aria-hidden />
                        <span className="flex-1 text-sm font-medium text-heading">{c.name}</span>
                        <span className="text-xs text-muted">
                          {c._count.projects} project{c._count.projects === 1 ? "" : "s"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
