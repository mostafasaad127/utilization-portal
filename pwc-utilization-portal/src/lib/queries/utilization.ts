import "server-only";
import { db } from "@/lib/db";
import { fiscalMonths, todayUtc, type FiscalYear } from "@/lib/domain/fiscal-year";
import { monthEnd, utilizationOn, utilizationOver, type BookedInterval } from "@/lib/domain/utilization";

/**
 * Loads every active person with their bookings and computes utilization.
 * An assignment's effective end is its own end date, else the project's end
 * date, else open-ended. Pipeline projects count as tentative.
 */
export async function loadBookings(filter?: { territoryId?: string; capabilityId?: string }) {
  const people = await db.person.findMany({
    where: {
      isActive: true,
      ...(filter?.territoryId ? { territoryId: filter.territoryId } : {}),
      ...(filter?.capabilityId ? { primaryCapabilityId: filter.capabilityId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      grade: true,
      territory: { select: { code: true } },
      primaryCapability: { select: { code: true, name: true } },
      assignments: {
        where: { project: { deletedAt: null } },
        select: {
          id: true,
          allocation: true,
          startDate: true,
          endDate: true,
          project: { select: { id: true, name: true, status: true, endDate: true, client: { select: { name: true } } } },
        },
      },
    },
  });

  return people.map((p) => {
    const bookings = p.assignments.filter(isBookable).map((a) => ({
      assignmentId: a.id,
      project: a.project,
      allocation: a.allocation,
      start: a.startDate,
      end: a.endDate ?? a.project.endDate ?? null,
      tentative: a.project.status === "PIPELINE",
    }));
    return { ...p, bookings };
  });
}

/** A closed project with no end date would otherwise book its team forever. */
export function isBookable(a: { endDate: Date | null; project: { status: string; endDate: Date | null } }) {
  return !(a.project.status === "CLOSED" && !a.endDate && !a.project.endDate);
}

export type PersonBookings = Awaited<ReturnType<typeof loadBookings>>[number];

export function currentUtilization(person: PersonBookings, day = todayUtc()) {
  return utilizationOn(person.bookings as BookedInterval[], day);
}

export function monthlyUtilization(person: PersonBookings, fy: FiscalYear) {
  return fiscalMonths(fy).map((m) => ({ month: m, ...utilizationOver(person.bookings as BookedInterval[], m, monthEnd(m)) }));
}

/** Team-level average per fiscal month (people with no bookings count as 0%). */
export function teamMonthly(people: PersonBookings[], fy: FiscalYear) {
  const months = fiscalMonths(fy);
  return months.map((m, i) => {
    let confirmed = 0;
    let tentative = 0;
    for (const p of people) {
      const r = utilizationOver(p.bookings as BookedInterval[], m, monthEnd(m));
      confirmed += r.confirmed;
      tentative += r.tentative;
    }
    const n = Math.max(people.length, 1);
    return { month: m, index: i, confirmed: Math.round(confirmed / n), tentative: Math.round(tentative / n) };
  });
}
