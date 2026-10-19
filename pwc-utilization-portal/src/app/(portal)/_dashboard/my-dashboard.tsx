import Link from "next/link";
import { AlertTriangle, BellRing, CalendarClock, FolderKanban, Gauge, Plus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { myPersonId, riskScope } from "@/lib/access";
import { fiscalMonths, fiscalYearOf, todayUtc } from "@/lib/domain/fiscal-year";
import { monthEnd, utilizationOn, utilizationOver, type BookedInterval } from "@/lib/domain/utilization";
import { isBookable } from "@/lib/queries/utilization";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, EmptyState } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { RagBadge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { HeatCell, HeatLegend } from "@/components/charts/heat-cell";
import { BAND_LABEL } from "@/components/ui/util-bar";
import { band } from "@/lib/domain/utilization";
import { cn, formatDate, formatMonth, pluralise, relativeTime } from "@/lib/utils";
import { greeting } from "./team-dashboard";

const STALE_DAYS = 14;

/**
 * Personal dashboard for employees. Every query is keyed on the signed-in
 * user's own resource record — no team-wide figures are loaded.
 */
export async function MyDashboard({ user }: { user: CurrentUser }) {
  const personId = await myPersonId(user);
  const today = todayUtc();
  const fy = fiscalYearOf(today);
  const staleBefore = new Date(today.getTime() - STALE_DAYS * 86_400_000);

  const [assignments, risks] = await Promise.all([
    db.assignment.findMany({
      where: { personId, project: { deletedAt: null } },
      orderBy: { startDate: "asc" },
      include: {
        capability: { select: { name: true } },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            rag: true,
            endDate: true,
            client: { select: { name: true } },
            updates: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          },
        },
      },
    }),
    db.risk.findMany({
      where: { ...riskScope(user), status: { not: "CLOSED" } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  const bookings = assignments.filter(isBookable).map((a) => ({
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

  const current = bookings.filter((b) => b.start <= today && (b.end === null || b.end >= today));
  const upcoming = bookings.filter((b) => b.start > today);
  const nextRollOff = current
    .filter((b) => !b.tentative && b.end)
    .map((b) => b.end!)
    .sort((x, y) => x.getTime() - y.getTime())[0];

  // Active projects with no status update in the last two weeks.
  const seen = new Set<string>();
  const needsUpdate = current
    .map((b) => b.a.project)
    .filter((p) => (p.status === "ACTIVE" || p.status === "ON_HOLD") && !seen.has(p.id) && seen.add(p.id))
    .filter((p) => !p.updates[0] || p.updates[0].createdAt < staleBefore);

  const projectCount = new Set(current.map((b) => b.a.project.id)).size;
  const myBand = band(now.confirmed);

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}, ${user.name.split(" ")[0]}`}
        description={`Your work in ${fy.label} (${formatDate(fy.start)} – ${formatDate(fy.end)})`}
        actions={
          <>
            <ButtonLink href="/projects/join" variant="secondary">
              <UserPlus className="size-4" aria-hidden /> Join a project
            </ButtonLink>
            <ButtonLink href="/projects/new">
              <Plus className="size-4" aria-hidden /> Log a project
            </ButtonLink>
          </>
        }
      />
      <PageBody className="flex flex-col gap-6">
        {now.confirmed === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border-l-4 border-warning bg-warning-tint px-5 py-4 text-sm text-warning-text">
            <CalendarClock className="size-5 shrink-0" aria-hidden />
            <p className="flex-1">
              You&apos;re not booked on any project today. If you&apos;re working on something, log it or join it so your utilization is accurate.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Your utilization today"
            value={now.confirmed}
            unit="%"
            detail={`${BAND_LABEL[myBand]}${now.tentative ? ` · +${now.tentative}% in pipeline` : ""}`}
            tone={myBand === "over" ? "attention" : "default"}
            icon={<Gauge className="size-5" aria-hidden />}
          />
          <StatTile label={`${fy.label} average`} value={fyAvg.confirmed} unit="%" detail="Weighted by working days, Jul – Jun" />
          <StatTile
            label="Current projects"
            value={projectCount}
            detail={upcoming.length ? `${pluralise(upcoming.length, "upcoming assignment")}` : "Nothing upcoming yet"}
            href="/projects"
            icon={<FolderKanban className="size-5" aria-hidden />}
          />
          <StatTile
            label="Next roll-off"
            value={nextRollOff ? formatDate(nextRollOff) : "—"}
            detail={nextRollOff ? "Earliest end of a current assignment" : "No dated roll-off"}
            icon={<CalendarClock className="size-5" aria-hidden />}
          />
        </div>

        {needsUpdate.length > 0 && (
          <Panel className="shadow-[inset_3px_0_0_var(--ap-primary),var(--ap-shadow-low)]">
            <PanelHeader
              title="Waiting for your update"
              description={`No status update in the last ${STALE_DAYS} days`}
              actions={<BellRing className="size-5 text-primary" aria-hidden />}
            />
            <ul className="divide-y divide-line border-t border-line">
              {needsUpdate.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-heading">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.client.name} · {p.updates[0] ? `last update ${relativeTime(p.updates[0].createdAt)}` : "no updates yet"}
                    </p>
                  </div>
                  <RagBadge rag={p.rag} />
                  <ButtonLink href={`/projects/${p.id}?tab=updates`} size="sm" variant="secondary">
                    Post update
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel>
          <PanelHeader title={`Your ${fy.label} by month`} description="Share of your working days booked" actions={<HeatLegend />} />
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader
              title="Your current & upcoming work"
              actions={
                <Link href="/projects" className="text-sm text-primary hover:underline">
                  All my projects
                </Link>
              }
            />
            {current.length + upcoming.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="size-5" />}
                title="No current or upcoming work logged"
                description="Log a project you're working on, or join one a colleague already added."
                action={<ButtonLink href="/projects/new">Log a project</ButtonLink>}
              />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Project</Th>
                    <Th className="text-right">Allocation</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th>Status</Th>
                  </tr>
                </THead>
                <tbody>
                  {[...current, ...upcoming].map(({ a, start, end }) => (
                    <Tr key={a.id}>
                      <Td className="min-w-[16rem]">
                        <Link href={`/projects/${a.project.id}`} className="font-medium text-heading hover:text-primary hover:underline">
                          {a.project.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {a.project.client.name}
                          {a.capability ? ` · ${a.capability.name}` : ""}
                        </p>
                      </Td>
                      <Td className="tabular text-right font-medium text-heading">{a.allocation}%</Td>
                      <Td className="tabular whitespace-nowrap">{formatDate(start)}</Td>
                      <Td className="tabular whitespace-nowrap">{formatDate(end, "Open-ended")}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <StatusBadge status={a.project.status} />
                          <RagBadge rag={a.project.rag} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Open risks on your projects"
              actions={
                <Link href="/risks" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              }
            />
            {risks.length === 0 ? (
              <EmptyState icon={<AlertTriangle className="size-5" />} title="No open risks" className="py-8" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {risks.map((r) => (
                  <li key={r.id}>
                    <Link href={`/projects/${r.project.id}?tab=risks`} className="flex items-start gap-3 px-6 py-3 hover:bg-hover">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-heading">{r.title}</p>
                        <p className="truncate text-xs text-muted">{r.project.name}</p>
                      </div>
                      <SeverityBadge severity={r.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <PanelBody className="px-1 pb-0 text-xs text-muted">
          Only you and portal admins can see your allocation and utilization.
        </PanelBody>
      </PageBody>
    </>
  );
}
