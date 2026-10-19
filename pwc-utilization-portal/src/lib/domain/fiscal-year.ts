/**
 * PwC fiscal years run 1 July – 30 June and are named after the year they end
 * in: FY27 = 1 Jul 2026 – 30 Jun 2027. All dates are handled as UTC calendar
 * dates (Postgres `date` columns), never local times.
 */
export type FiscalYear = { label: string; year: number; start: Date; end: Date };

export function fiscalYearOf(date: Date): FiscalYear {
  const y = date.getUTCFullYear();
  const endYear = date.getUTCMonth() >= 6 ? y + 1 : y;
  return fiscalYear(endYear);
}

export function fiscalYear(endYear: number): FiscalYear {
  return {
    label: `FY${String(endYear).slice(-2)}`,
    year: endYear,
    start: new Date(Date.UTC(endYear - 1, 6, 1)),
    end: new Date(Date.UTC(endYear, 5, 30)),
  };
}

export function parseFiscalYear(label: string | undefined | null): FiscalYear | null {
  const m = /^FY(\d{2})$/i.exec(label ?? "");
  return m ? fiscalYear(2000 + Number(m[1])) : null;
}

/** Inclusive overlap of [start, end] with a period. A null end means open-ended. */
export function overlaps(start: Date, end: Date | null, periodStart: Date, periodEnd: Date) {
  return start <= periodEnd && (end === null || end >= periodStart);
}

/** The twelve month starts of a fiscal year, July first. */
export function fiscalMonths(fy: FiscalYear): Date[] {
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(fy.year - 1, 6 + i, 1)));
}

export function todayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
