import Link from "next/link";
import { AlertTriangle, ArrowRight, Briefcase, CalendarClock, Gauge, Plus, UserMinus } from "lucide-react";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { fiscalYearOf, todayUtc } from "@/lib/domain/fiscal-year";
import { band } from "@/lib/domain/utilization";
import { currentUtilization, loadBookings, teamMonthly } from "@/lib/queries/utilization";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelBody, PanelHeader, EmptyState } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat-tile";
import { RagBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BAND_COLOR, BAND_LABEL, UtilBar } from "@/components/ui/util-bar";
import { MonthlyUtilizationChart } from "@/components/charts/monthly-utilization-chart";
import { formatDate, pluralise } from "@/lib/utils";

export function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Team-wide dashboard: admins only (the page picks the dashboard by role). */
export async function TeamDashboard({ user }: { user: CurrentUser }) {
  const today = todayUtc();
  const fy = fiscalYearOf(today);
  const in30 = new Date(today.getTime() + 30 * 86_400_000);

  const [people, openProjects, attention, openHighRisks, byLos] = await Promise.all([
    loadBookings(),
    db.project.count({ where: { deletedAt: null, status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    db.project.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "ON_HOLD", "PIPELINE"] }, rag: { in: ["AMBER", "RED"] } },
      orderBy: [{ rag: "desc" }, { endDate: "asc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        rag: true,
        status: true,
        endDate: true,
        client: { select: { name: true } },
        _count: { select: { risks: { where: { status: { not: "CLOSED" } } } } },
      },
    }),
    db.risk.count({ where: { status: { not: "CLOSED" }, severity: { in: ["HIGH", "CRITICAL"] }, project: { deletedAt: null } } }),
    db.project.groupBy({
      by: ["lineOfServiceId"],
      where: { deletedAt: null, status: { in: ["ACTIVE", "ON_HOLD"] } },
      _count: { _all: true },
    }),
  ]);

  const losNames = new Map(
    (await db.lineOfService.findMany({ select: { id: true, name: true } })).map((l) => [l.id, l.name] as const),
  );
  const losRows = byLos
    .map((r) => ({ name: r.lineOfServiceId ? (losNames.get(r.lineOfServiceId) ?? "Unassigned") : "Unassigned", count: r._count._all }))
    .sort((a, b) => b.count - a.count);
  const losMax = Math.max(1, ...losRows.map((r) => r.count));

  const withUtil = people.map((p) => ({ person: p, util: currentUtilization(p, today) }));
  const avgUtil = Math.round(withUtil.reduce((s, r) => s + r.util.confirmed, 0) / Math.max(withUtil.length, 1));
  const bench = withUtil.filter((r) => r.util.confirmed === 0);
  const over = withUtil.filter((r) => r.util.confirmed > 100);

  const bands = (["bench", "under", "healthy", "full", "over"] as const).map((b) => ({
    band: b,
    count: withUtil.filter((r) => band(r.util.confirmed) === b).length,
  }));

  const rollOffs = people
    .flatMap((p) =>
      p.bookings
        .filter((b) => !b.tentative && b.end && b.end >= today && b.end <= in30)
        .map((b) => ({ person: p, booking: b })),
    )
    .sort((a, b) => a.booking.end!.getTime() - b.booking.end!.getTime())
    .slice(0, 8);

  const monthly = teamMonthly(people, fy);
  const currentIndex = monthly.findIndex((m) => m.month.getUTCMonth() === today.getUTCMonth());

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}, ${user.name.split(" ")[0]}`}
        description={`${fy.label} (${formatDate(fy.start)} – ${formatDate(fy.end)}) · figures as of ${formatDate(today)}`}
        actions={
          <ButtonLink href="/projects/new">
            <Plus className="size-4" aria-hidden /> New project
          </ButtonLink>
        }
      />
      <PageBody className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Team utilization today"
            value={avgUtil}
            unit="%"
            detail={`Average confirmed allocation across ${pluralise(people.length, "person", "people")}`}
            href="/utilization"
            icon={<Gauge className="size-5" aria-hidden />}
          />
          <StatTile
            label="Active projects"
            value={openProjects}
            detail="Active and on hold"
            href="/projects?status=OPEN"
            icon={<Briefcase className="size-5" aria-hidden />}
          />
          <StatTile
            label="On the bench"
            value={bench.length}
            detail={over.length > 0 ? `${pluralise(over.length, "person", "people")} over-allocated` : "No one is over-allocated"}
            href="/people?availability=bench"
            tone={bench.length > 0 ? "attention" : "default"}
            icon={<UserMinus className="size-5" aria-hidden />}
          />
          <StatTile
            label="High & critical risks"
            value={openHighRisks}
            detail="Open or being mitigated"
            href="/risks?severity=HIGH_PLUS"
            tone={openHighRisks > 0 ? "attention" : "default"}
            icon={<AlertTriangle className="size-5" aria-hidden />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader
              title={`Team utilization, ${fy.label}`}
              description="Average monthly allocation, weighted by working days"
              actions={
                <Link href="/utilization" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Capacity view <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            />
            <PanelBody>
              <MonthlyUtilizationChart
                data={monthly.map((m) => ({ month: m.month.toISOString(), confirmed: m.confirmed, tentative: m.tentative }))}
                currentIndex={currentIndex}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Utilization today" description="People by allocation band" />
            <PanelBody className="flex flex-col gap-3">
              {bands.map((b) => (
                <Link
                  key={b.band}
                  href={`/people?availability=${b.band}`}
                  className="group flex items-center gap-3 rounded-sm py-1 hover:bg-hover"
                >
                  <span className="size-3 shrink-0 rounded-xs" style={{ background: BAND_COLOR[b.band] }} aria-hidden />
                  <span className="flex-1 text-sm text-body group-hover:text-heading">{BAND_LABEL[b.band]}</span>
                  <span className="tabular text-sm font-medium text-heading">{b.count}</span>
                  <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-container-alt" aria-hidden>
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(b.count / Math.max(people.length, 1)) * 100}%`, background: BAND_COLOR[b.band] }}
                    />
                  </span>
                </Link>
              ))}
              <p className="mt-2 border-t border-line pt-3 text-xs text-muted">
                Bands: bench 0% · under 1–69% · healthy 70–99% · full 100% · over &gt;100%
              </p>
            </PanelBody>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="Needs attention" description="Open projects rated Amber or Red" />
            {attention.length === 0 ? (
              <EmptyState title="Everything is on track" description="No open projects are rated Amber or Red." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {attention.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-hover">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-heading">{p.name}</p>
                        <p className="truncate text-xs text-muted">
                          {p.client.name} · ends {formatDate(p.endDate)}
                          {p._count.risks > 0 && ` · ${pluralise(p._count.risks, "open risk")}`}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                      <RagBadge rag={p.rag} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Rolling off in the next 30 days" description="Plan the next assignment before people hit the bench" />
            {rollOffs.length === 0 ? (
              <EmptyState icon={<CalendarClock className="size-5" />} title="No roll-offs in the next 30 days" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {rollOffs.map(({ person, booking }) => (
                  <li key={booking.assignmentId} className="flex items-center gap-4 px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${person.id}`} className="text-sm font-medium text-heading hover:text-primary hover:underline">
                        {person.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {booking.allocation}% on{" "}
                        <Link href={`/projects/${booking.project.id}`} className="hover:underline">
                          {booking.project.name}
                        </Link>
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-sm text-body">{formatDate(booking.end)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <PanelHeader
              title="Available now"
              description="People with no confirmed allocation today"
              actions={
                <Link href="/people?availability=bench" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              }
            />
            {bench.length === 0 ? (
              <EmptyState title="Nobody is on the bench" />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {bench.slice(0, 8).map(({ person, util }) => (
                  <li key={person.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${person.id}`} className="text-sm font-medium text-heading hover:text-primary hover:underline">
                        {person.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {person.primaryCapability?.name ?? "No capability"} · {person.territory?.code ?? "—"}
                        {util.tentative > 0 && ` · ${util.tentative}% in pipeline`}
                      </p>
                    </div>
                    <UtilBar value={util.confirmed} tentative={util.tentative} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Active projects by line of service" />
            <PanelBody className="flex flex-col gap-3">
              {losRows.length === 0 && <p className="text-sm text-muted">No active projects.</p>}
              {losRows.map((r) => (
                <div key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3">
                  <span className="truncate text-sm text-body" title={r.name}>
                    {r.name}
                  </span>
                  <span className="h-3 rounded-r-sm bg-primary" style={{ width: `${(r.count / losMax) * 100}%` }} aria-hidden />
                  <span className="tabular text-right text-sm font-medium text-heading">{r.count}</span>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
