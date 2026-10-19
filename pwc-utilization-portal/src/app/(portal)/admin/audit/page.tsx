import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 50;
const CATEGORIES = [
  { value: "auth", label: "Sign-ins" },
  { value: "project", label: "Projects" },
  { value: "assignment", label: "Assignments" },
  { value: "risk", label: "Risks" },
  { value: "user", label: "Users & roles" },
  { value: "person", label: "Resource pool" },
  { value: "import", label: "Imports" },
];
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = str(sp.q)?.slice(0, 100);
  const category = CATEGORIES.find((c) => c.value === str(sp.category))?.value;
  const page = Math.max(1, Math.min(10_000, Number(str(sp.page)) || 1));

  const where: Prisma.AuditLogWhereInput = {};
  if (category) where.action = { startsWith: `${category}.` };
  if (q) where.OR = [{ summary: { contains: q, mode: "insensitive" } }, { actor: { name: { contains: q, mode: "insensitive" } } }, { actor: { email: { contains: q, mode: "insensitive" } } }];

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  const href = (n: number) => {
    const p = new URLSearchParams(Object.entries({ q, category, page: n > 1 ? String(n) : undefined }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/admin/audit${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Audit log" description="An append-only record of sign-ins, changes, exports and imports. Entries cannot be edited or deleted from the portal." />
      <PageBody className="flex flex-col gap-4">
        <FilterBar
          searchPlaceholder="Search by person or description"
          values={{ q, category }}
          filters={[{ name: "category", label: "Category", options: CATEGORIES }]}
        />
        <Panel>
          {logs.length === 0 ? (
            <EmptyState icon={<History className="size-5" />} title="No audit entries match" />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th>When</Th>
                    <Th>Who</Th>
                    <Th>Action</Th>
                    <Th>Details</Th>
                    <Th>IP address</Th>
                  </tr>
                </THead>
                <tbody>
                  {logs.map((l) => (
                    <Tr key={l.id}>
                      <Td className="tabular whitespace-nowrap">{formatDateTime(l.createdAt)}</Td>
                      <Td className="min-w-[12rem]">
                        <p className="text-heading">{l.actor?.name ?? "System"}</p>
                        {l.actor && <p className="text-xs text-muted">{l.actor.email}</p>}
                      </Td>
                      <Td>
                        <Badge>{l.action}</Badge>
                      </Td>
                      <Td className="max-w-xl min-w-[16rem]">
                        {l.entityType === "project" && l.entityId ? (
                          <Link href={`/projects/${l.entityId}?tab=history`} className="hover:text-primary hover:underline">
                            {l.summary}
                          </Link>
                        ) : (
                          l.summary
                        )}
                      </Td>
                      <Td className="tabular text-xs text-muted">{l.ipAddress ?? "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} total={total} pageSize={PAGE} hrefFor={href} />
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
