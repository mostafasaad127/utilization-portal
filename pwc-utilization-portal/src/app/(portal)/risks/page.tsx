import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isAdmin, riskScope } from "@/lib/access";
import { RISK_STATUS_LABEL, RISK_STATUSES, SEVERITIES, SEVERITY_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { RagBadge, RiskStatusBadge, SeverityBadge } from "@/components/ui/badge";
import { formatDate, pluralise } from "@/lib/utils";

export const metadata: Metadata = { title: "Risk register" };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function RisksPage({ searchParams }: PageProps<"/risks">) {
  const user = await requireUser();
  const admin = isAdmin(user);
  const sp = await searchParams;
  const q = str(sp.q)?.slice(0, 100);
  const severity = str(sp.severity);
  const status = str(sp.status) ?? "ACTIVE";

  // Employees only see risks on projects they're assigned to.
  const where: Prisma.RiskWhereInput = { ...riskScope(user) };
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { project: { name: { contains: q, mode: "insensitive" } } }];
  if (severity === "HIGH_PLUS") where.severity = { in: ["HIGH", "CRITICAL"] };
  else if (SEVERITIES.includes(severity as never)) where.severity = severity as never;
  if (status === "ACTIVE") where.status = { not: "CLOSED" };
  else if (RISK_STATUSES.includes(status as never)) where.status = status as never;

  const risks = await db.risk.findMany({
    where,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: { project: { select: { id: true, name: true, rag: true, client: { select: { name: true } } } } },
  });

  return (
    <>
      <PageHeader
        title={admin ? "Risk register" : "My risks"}
        description={admin ? "Risks and challenges across every project, highest severity first." : "Risks and challenges on the projects you're working on."}
      />
      <PageBody className="flex flex-col gap-4">
        <FilterBar
          searchPlaceholder="Search risks or projects"
          values={{ q, severity, status: str(sp.status) }}
          filters={[
            {
              name: "status",
              label: "Status",
              noEmpty: true,
              defaultValue: "ACTIVE",
              options: [{ value: "ACTIVE", label: "Open & mitigating" }, ...RISK_STATUSES.map((s) => ({ value: s, label: RISK_STATUS_LABEL[s] })), { value: "ALL", label: "All" }],
            },
            {
              name: "severity",
              label: "Severity",
              options: [{ value: "HIGH_PLUS", label: "High & critical" }, ...SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))],
            },
          ]}
        />
        <Panel>
          {risks.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="size-5" />} title="No risks match these filters" />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th>Risk</Th>
                    <Th>Project</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                    <Th>Owner</Th>
                    <Th>Raised</Th>
                  </tr>
                </THead>
                <tbody>
                  {risks.map((r) => (
                    <Tr key={r.id}>
                      <Td className="max-w-xl min-w-[20rem] py-3">
                        <p className="text-heading">{r.title}</p>
                        {r.mitigation && <p className="mt-1 text-xs text-muted">Mitigation: {r.mitigation}</p>}
                      </Td>
                      <Td className="min-w-[14rem]">
                        <Link href={`/projects/${r.project.id}?tab=risks`} className="text-heading hover:text-primary hover:underline">
                          {r.project.name}
                        </Link>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                          {r.project.client.name} <RagBadge rag={r.project.rag} />
                        </div>
                      </Td>
                      <Td>
                        <SeverityBadge severity={r.severity} />
                      </Td>
                      <Td>
                        <RiskStatusBadge status={r.status} />
                      </Td>
                      <Td>{r.owner ?? "—"}</Td>
                      <Td className="tabular whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-line px-6 py-3 text-sm text-muted">{pluralise(risks.length, "risk")}</p>
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
