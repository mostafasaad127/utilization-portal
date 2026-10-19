import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { fiscalYearOf, todayUtc } from "@/lib/domain/fiscal-year";
import { utilizationOn, utilizationOver, type BookedInterval } from "@/lib/domain/utilization";
import { GRADE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { HeatCell, HeatLegend } from "@/components/charts/heat-cell";
import { fiscalMonths } from "@/lib/domain/fiscal-year";
import { isBookable } from "@/lib/queries/utilization";
import { monthEnd } from "@/lib/domain/utilization";
import { cn, formatDate, formatMonth } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await db.person.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Person" };
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  await requireRole("ADMIN"); // team-wide data is for admins only
  const { id } = await params;
  const person = await db.person.findUnique({
    where: { id },
    include: {
      territory: true,
      primaryCapability: true,
      assignments: {
        where: { project: { deletedAt: null } },
        include: {
          capability: true,
          project: { select: { id: true, name: true, status: true, endDate: true, client: { select: { name: true } } } },
        },
        orderBy: { startDate: "desc" },
      },
    },
  });
  if (!person) notFound();

  const today = todayUtc();
  const fy = fiscalYearOf(today);
  const bookings = person.assignments.filter(isBookable).map((a) => ({
    a,
    allocation: a.allocation,
    start: a.startDate,
    end: a.endDate ?? a.project.endDate ?? null,
    tentative: a.project.status === "PIPELINE",
  }));
  const intervals = bookings as BookedInterval[];
  const now = utilizationOn(intervals, today);
  const fyAvg = utilizationOver(intervals, fy.start, fy.end);
  const months = fiscalMonths(fy).map((m) => ({ month: m, ...utilizationOver(intervals, m, monthEnd(m)) }));

  const currentAndUpcoming = bookings.filter((b) => b.end === null || b.end >= today).sort((x, y) => x.start.getTime() - y.start.getTime());
  const past = bookings.filter((b) => b.end !== null && b.end < today);
  const nextRollOff = currentAndUpcoming
    .filter((b) => !b.tentative && b.start <= today && b.end)
    .map((b) => b.end!)
    .sort((x, y) => x.getTime() - y.getTime())[0];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "People", href: "/people" }, { label: person.name }]}
        title={person.name}
        description={[person.grade && GRADE_LABEL[person.grade], person.primaryCapability?.name, person.territory?.name].filter(Boolean).join(" · ")}
        meta={
          person.email && (
            <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Mail className="size-4" aria-hidden /> {person.email}
            </a>
          )
        }
      />
      <PageBody className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Allocated today" value={now.confirmed} unit="%" detail={now.tentative ? `+${now.tentative}% in pipeline` : "Confirmed work only"} />
          <StatTile label={`${fy.label} average`} value={fyAvg.confirmed} unit="%" detail="Weighted by working days, Jul – Jun" />
          <StatTile label="Next roll-off" value={nextRollOff ? formatDate(nextRollOff) : "—"} detail={nextRollOff ? "Earliest end of a current assignment" : "No dated roll-off"} />
        </div>

        <Panel>
          <PanelHeader title={`${fy.label} by month`} actions={<HeatLegend />} />
          <div className="scrollbar-thin overflow-x-auto px-6 pb-6">
            <div className="grid min-w-[720px] grid-cols-12 gap-1">
              {months.map((m) => (
                <div key={m.month.toISOString()} className="flex flex-col gap-1">
                  <span className={cn("text-center text-xs", m.month.getUTCMonth() === today.getUTCMonth() ? "font-medium text-primary" : "text-muted")}>
                    {formatMonth(m.month)}
                  </span>
                  <HeatCell value={m.confirmed} tentative={m.tentative} label={formatMonth(m.month)} />
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Current & upcoming assignments" />
          {currentAndUpcoming.length === 0 ? (
            <EmptyState title="No current or upcoming assignments" description="This person is available for staffing." />
          ) : (
            <AssignmentTable rows={currentAndUpcoming} />
          )}
        </Panel>

        {past.length > 0 && (
          <Panel>
            <PanelHeader title="Past assignments" />
            <AssignmentTable rows={past} />
          </Panel>
        )}
      </PageBody>
    </>
  );
}

type Row = {
  a: { id: string; allocation: number; capability: { name: string } | null; project: { id: string; name: string; status: "PIPELINE" | "ACTIVE" | "ON_HOLD" | "CLOSED"; client: { name: string } } };
  start: Date;
  end: Date | null;
};

function AssignmentTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Project</Th>
          <Th>Capability</Th>
          <Th className="text-right">Allocation</Th>
          <Th>From</Th>
          <Th>To</Th>
          <Th>Status</Th>
        </tr>
      </THead>
      <tbody>
        {rows.map(({ a, start, end }) => (
          <Tr key={a.id}>
            <Td className="min-w-[16rem]">
              <Link href={`/projects/${a.project.id}`} className="font-medium text-heading hover:text-primary hover:underline">
                {a.project.name}
              </Link>
              <p className="text-xs text-muted">{a.project.client.name}</p>
            </Td>
            <Td>{a.capability?.name ?? "—"}</Td>
            <Td className="tabular text-right font-medium text-heading">{a.allocation}%</Td>
            <Td className="tabular whitespace-nowrap">{formatDate(start)}</Td>
            <Td className="tabular whitespace-nowrap">{formatDate(end, "Open-ended")}</Td>
            <Td>
              <StatusBadge status={a.project.status} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
