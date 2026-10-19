/**
 * Utilization maths. An assignment books `allocation`% of a person's capacity
 * between its start and end dates (inclusive). Utilization over a period is
 * weighted by working days (Mon–Fri), so a 100% assignment covering half of
 * a month counts as 50% for that month.
 */
export type BookedInterval = {
  allocation: number;
  start: Date;
  end: Date | null; // null = open-ended
  tentative?: boolean; // pipeline work, reported separately
};

const DAY = 86_400_000;

export function workingDays(from: Date, to: Date): number {
  if (to < from) return 0;
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  const fullWeeks = Math.floor(days / 7);
  let count = fullWeeks * 5;
  const startDow = from.getUTCDay();
  for (let i = 0; i < days % 7; i++) {
    const dow = (startDow + i) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function monthEnd(monthStart: Date) {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
}

/** Weighted utilization % over [from, to]. Returns confirmed and tentative separately. */
export function utilizationOver(intervals: BookedInterval[], from: Date, to: Date) {
  const capacity = workingDays(from, to);
  if (capacity === 0) return { confirmed: 0, tentative: 0 };
  let confirmed = 0;
  let tentative = 0;
  for (const i of intervals) {
    const s = i.start > from ? i.start : from;
    const e = i.end === null || i.end > to ? to : i.end;
    const share = (workingDays(s, e) / capacity) * i.allocation;
    if (i.tentative) tentative += share;
    else confirmed += share;
  }
  return { confirmed: Math.round(confirmed), tentative: Math.round(tentative) };
}

/** Allocation booked on a single day (no weighting). */
export function utilizationOn(intervals: BookedInterval[], day: Date) {
  let confirmed = 0;
  let tentative = 0;
  for (const i of intervals) {
    if (i.start <= day && (i.end === null || i.end >= day)) {
      if (i.tentative) tentative += i.allocation;
      else confirmed += i.allocation;
    }
  }
  return { confirmed, tentative };
}

export type UtilizationBand = "bench" | "under" | "healthy" | "full" | "over";

/** Bench 0%, under 1–69%, healthy 70–99%, full 100%, over-allocated above 100%. */
export function band(pct: number): UtilizationBand {
  if (pct <= 0) return "bench";
  if (pct < 70) return "under";
  if (pct < 100) return "healthy";
  if (pct === 100) return "full";
  return "over";
}
