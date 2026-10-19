import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireRole } from "@/lib/session";
import { todayUtc } from "@/lib/domain/fiscal-year";
import { band, type UtilizationBand } from "@/lib/domain/utilization";
import { currentUtilization, loadBookings } from "@/lib/queries/utilization";
import { getReferenceData } from "@/lib/queries/reference";
import { GRADE_LABEL } from "@/lib/labels";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Panel, EmptyState } from "@/components/ui/panel";
import { FilterBar } from "@/components/ui/filter-bar";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { BAND_LABEL, UtilBar } from "@/components/ui/util-bar";
import { formatDate, initials, pluralise } from "@/lib/utils";

export const metadata: Metadata = { title: "People" };

const BANDS: UtilizationBand[] = ["bench", "under", "healthy", "full", "over"];
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  await requireRole("ADMIN"); // team-wide data is for admins only
  const sp = await searchParams;
  const q = str(sp.q)?.toLowerCase().slice(0, 100);
  const territory = str(sp.territory);
  const capability = str(sp.capability);
  const availability = BANDS.find((b) => b === str(sp.availability));

  const today = todayUtc();
  const [people, ref] = await Promise.all([loadBookings(), getReferenceData()]);

  const rows = people
    .map((p) => {
      const util = currentUtilization(p, today);
      const current = p.bookings.filter((b) => !b.tentative && b.start <= today && (b.end === null || b.end >= today));
      const upcoming = p.bookings.filter((b) => b.start > today).sort((a, b) => a.start.getTime() - b.start.getTime());
      const ends = current.map((b) => b.end).filter((d): d is Date => d !== null);
      const nextRollOff = ends.length ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
      return { p, util, current, upcoming, nextRollOff, band: band(util.confirmed) };
    })
    .filter((r) => !q || r.p.name.toLowerCase().includes(q))
    .filter((r) => !territory || r.p.territory?.code === territory)
    .filter((r) => !capability || r.p.primaryCapability?.code === capability)
    .filter((r) => !availability || r.band === availability);

  return (
    <>
      <PageHeader
        title="People"
        description="The resource pool with today's allocation, current projects and next roll-off date."
      />
      <PageBody className="flex flex-col gap-4">
        <FilterBar
          searchPlaceholder="Search people"
          values={{ q, territory, capability, availability }}
          filters={[
            { name: "availability", label: "Availability", options: BANDS.map((b) => ({ value: b, label: BAND_LABEL[b] })) },
            { name: "territory", label: "Territory", options: ref.territories.map((t) => ({ value: t.code, label: t.name })) },
            { name: "capability", label: "Primary capability", options: ref.capabilities.map((c) => ({ value: c.code, label: c.name })) },
          ]}
        />
        <Panel>
          {rows.length === 0 ? (
            <EmptyState icon={<Users className="size-5" />} title="No people match these filters" />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Capability</Th>
                    <Th>Territory</Th>
                    <Th>Today</Th>
                    <Th>Current projects</Th>
                    <Th>Next roll-off</Th>
                  </tr>
                </THead>
                <tbody>
                  {rows.map(({ p, util, current, upcoming, nextRollOff }) => (
                    <Tr key={p.id}>
                      <Td className="min-w-[14rem]">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-container-alt text-xs font-medium text-body">
                            {initials(p.name)}
                          </span>
                          <div>
                            <Link href={`/people/${p.id}`} className="font-medium text-heading hover:text-primary hover:underline">
                              {p.name}
                            </Link>
                            {p.grade && <p className="text-xs text-muted">{GRADE_LABEL[p.grade]}</p>}
                          </div>
                        </div>
                      </Td>
                      <Td>{p.primaryCapability?.name ?? "—"}</Td>
                      <Td>{p.territory?.code ?? "—"}</Td>
                      <Td>
                        <UtilBar value={util.confirmed} tentative={util.tentative} />
                      </Td>
                      <Td className="max-w-[22rem] min-w-[14rem]">
                        {current.length === 0 ? (
                          <span className="text-muted">
                            {upcoming[0] ? `Starts ${upcoming[0].project.name} on ${formatDate(upcoming[0].start)}` : "Available"}
                          </span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {current.slice(0, 2).map((b) => (
                              <li key={b.assignmentId} className="flex justify-between gap-3">
                                <Link href={`/projects/${b.project.id}`} className="truncate hover:text-primary hover:underline">
                                  {b.project.name}
                                </Link>
                                <span className="tabular text-xs text-muted">{b.allocation}%</span>
                              </li>
                            ))}
                            {current.length > 2 && <li className="text-xs text-muted">+{current.length - 2} more</li>}
                          </ul>
                        )}
                      </Td>
                      <Td className="tabular whitespace-nowrap">{current.length ? formatDate(nextRollOff, "Open-ended") : "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="border-t border-line px-6 py-3 text-sm text-muted">{pluralise(rows.length, "person", "people")}</p>
            </>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
