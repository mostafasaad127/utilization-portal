import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { fiscalMonths, fiscalYear, fiscalYearOf, parseFiscalYear, todayUtc } from "@/lib/domain/fiscal-year";
import { currentUtilization, loadBookings, monthlyUtilization, teamMonthly } from "@/lib/queries/utilization";
import { getReferenceData } from "@/lib/queries/reference";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { HeatCell, HeatLegend } from "@/components/charts/heat-cell";
import { cn, formatMonth } from "@/lib/utils";

export const metadata: Metadata = { title: "Utilization" };

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function UtilizationPage({ searchParams }: PageProps<"/utilization">) {
  await requireRole("ADMIN"); // team-wide data is for admins only
  const sp = await searchParams;
  const today = todayUtc();
  const current = fiscalYearOf(today);
  const fy = parseFiscalYear(str(sp.fy)) ?? current;
  const territory = str(sp.territory);
  const capability = str(sp.capability);
  const sort = str(sp.sort) === "util" ? "util" : "name";

  const ref = await getReferenceData();
  const people = await loadBookings({
    territoryId: ref.territories.find((t) => t.code === territory)?.id,
    capabilityId: ref.capabilities.find((c) => c.code === capability)?.id,
  });

  const months = fiscalMonths(fy);
  const rows = people.map((p) => ({ p, months: monthlyUtilization(p, fy), today: currentUtilization(p, today).confirmed }));
  if (sort === "util") rows.sort((a, b) => b.today - a.today);
  const team = teamMonthly(people, fy);
  const currentMonthIdx = fy.year === current.year ? months.findIndex((m) => m.getUTCMonth() === today.getUTCMonth()) : -1;

  const fyOptions = [current.year - 1, current.year, current.year + 1].map((y) => ({ value: fiscalYear(y).label, label: fiscalYear(y).label }));
  const sortHref = (s: string) => {
    const p = new URLSearchParams(Object.entries({ fy: str(sp.fy), territory, capability, sort: s === "name" ? undefined : s }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/utilization${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Utilization"
        description="Monthly capacity view. Each cell is the share of the person's working days booked, weighted by allocation."
      />
      <PageBody className="flex flex-col gap-4">
        <FilterBar
          showSearch={false}
          values={{ fy: str(sp.fy), territory, capability }}
          preserve={{ sort: sort === "util" ? "util" : undefined }}
          filters={[
            { name: "fy", label: "Fiscal year", options: fyOptions, noEmpty: true, defaultValue: current.label },
            { name: "territory", label: "Territory", options: ref.territories.map((t) => ({ value: t.code, label: t.name })) },
            { name: "capability", label: "Primary capability", options: ref.capabilities.map((c) => ({ value: c.code, label: c.name })) },
          ]}
        />
        <Panel>
          <PanelHeader
            title={`${fy.label} capacity`}
            description="Jul – Jun · confirmed allocation; a dot marks months with pipeline work"
            actions={
              <div className="flex items-center gap-1 rounded-sm bg-container-alt p-0.5 text-sm">
                {(["name", "util"] as const).map((s) => (
                  <Link
                    key={s}
                    href={sortHref(s)}
                    scroll={false}
                    aria-current={sort === s ? "true" : undefined}
                    className={cn("rounded-xs px-3 py-1", sort === s ? "bg-container text-heading shadow-low" : "text-muted hover:text-heading")}
                  >
                    {s === "name" ? "A–Z" : "Most utilized"}
                  </Link>
                ))}
              </div>
            }
          />
          <div className="px-6 pb-4">
            <HeatLegend />
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No people match these filters" />
          ) : (
            <div className="scrollbar-thin overflow-x-auto px-6 pb-6">
              <table className="w-full min-w-[900px] border-separate border-spacing-[3px] text-sm">
                <caption className="sr-only">Monthly utilization by person for {fy.label}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-container pr-3 text-left text-xs font-medium text-muted">
                      Person
                    </th>
                    {months.map((m, i) => (
                      <th
                        key={m.toISOString()}
                        scope="col"
                        className={cn("w-[7%] text-center text-xs font-medium", i === currentMonthIdx ? "text-primary" : "text-muted")}
                      >
                        {formatMonth(m)}
                        <span className="sr-only"> {m.getUTCFullYear()}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, months: ms }) => (
                    <tr key={p.id}>
                      <th scope="row" className="sticky left-0 z-10 bg-container pr-3 text-left font-normal whitespace-nowrap">
                        <Link href={`/people/${p.id}`} className="text-heading hover:text-primary hover:underline">
                          {p.name}
                        </Link>
                        <span className="ml-2 text-xs text-muted">{p.primaryCapability?.code}</span>
                      </th>
                      {ms.map((m, i) => (
                        <td key={i} className={cn(i === currentMonthIdx && "rounded-xs outline-2 outline-primary/60")}>
                          <HeatCell value={m.confirmed} tentative={m.tentative} label={`${p.name}, ${formatMonth(m.month)}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="sticky left-0 z-10 bg-container pt-2 pr-3 text-left text-xs font-medium text-heading">
                      Team average
                    </th>
                    {team.map((t) => (
                      <td key={t.index} className="tabular pt-2 text-center text-xs font-medium text-heading">
                        {t.confirmed}%
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
