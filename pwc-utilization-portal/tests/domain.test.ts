import { describe, expect, it } from "vitest";
import { fiscalYearOf, fiscalMonths, overlaps, parseFiscalYear } from "@/lib/domain/fiscal-year";
import { band, utilizationOn, utilizationOver, workingDays } from "@/lib/domain/utilization";
import { hasRole, isAllowedEmail, roleFromEntraClaims } from "@/lib/auth-policy";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("fiscal year", () => {
  it("runs July to June and is named after the end year", () => {
    expect(fiscalYearOf(d("2026-10-12")).label).toBe("FY27");
    expect(fiscalYearOf(d("2026-06-30")).label).toBe("FY26");
    expect(fiscalYearOf(d("2026-07-01")).label).toBe("FY27");
    const fy = parseFiscalYear("FY27")!;
    expect(fy.start.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(fy.end.toISOString().slice(0, 10)).toBe("2027-06-30");
    expect(fiscalMonths(fy)[0].toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(fiscalMonths(fy)[11].toISOString().slice(0, 10)).toBe("2027-06-01");
  });
  it("rejects malformed labels", () => {
    expect(parseFiscalYear("2027")).toBeNull();
    expect(parseFiscalYear(undefined)).toBeNull();
  });
  it("treats a null end date as open-ended", () => {
    expect(overlaps(d("2025-07-09"), null, d("2026-07-01"), d("2027-06-30"))).toBe(true);
    expect(overlaps(d("2025-01-01"), d("2025-06-30"), d("2026-07-01"), d("2027-06-30"))).toBe(false);
  });
});

describe("utilization", () => {
  it("counts weekdays only", () => {
    expect(workingDays(d("2026-10-12"), d("2026-10-18"))).toBe(5); // Mon–Sun
    expect(workingDays(d("2026-10-17"), d("2026-10-18"))).toBe(0); // weekend
    expect(workingDays(d("2026-10-01"), d("2026-10-31"))).toBe(22);
  });
  it("weights partial-month assignments by working days", () => {
    const r = utilizationOver(
      [{ allocation: 100, start: d("2026-10-01"), end: d("2026-10-15") }],
      d("2026-10-01"),
      d("2026-10-31"),
    );
    expect(r.confirmed).toBe(50); // 11 of 22 working days
  });
  it("separates tentative pipeline work and sums overlapping bookings", () => {
    const intervals = [
      { allocation: 50, start: d("2026-01-01"), end: null },
      { allocation: 60, start: d("2026-10-01"), end: d("2026-12-31") },
      { allocation: 25, start: d("2026-10-01"), end: null, tentative: true },
    ];
    expect(utilizationOn(intervals, d("2026-10-12"))).toEqual({ confirmed: 110, tentative: 25 });
    expect(band(110)).toBe("over");
    expect(band(0)).toBe("bench");
    expect(band(100)).toBe("full");
    expect(band(85)).toBe("healthy");
    expect(band(30)).toBe("under");
  });
});

describe("auth policy", () => {
  it("allows only configured domains and their subdomains", () => {
    expect(isAllowedEmail("jane.doe@pwc.com", ["pwc.com"])).toBe(true);
    expect(isAllowedEmail("jane.doe@uk.pwc.com", ["pwc.com"])).toBe(true);
    expect(isAllowedEmail("jane@notpwc.com", ["pwc.com"])).toBe(false);
    expect(isAllowedEmail("jane@pwc.com.evil.io", ["pwc.com"])).toBe(false);
    expect(isAllowedEmail("no-at-sign", ["pwc.com"])).toBe(false);
  });
  it("maps Entra app roles to the highest portal role", () => {
    expect(roleFromEntraClaims(["Portal.User", "Portal.Admin"])).toBe("ADMIN");
    expect(roleFromEntraClaims(["Portal.User"])).toBe("EMPLOYEE");
    expect(roleFromEntraClaims(["Something.Else"])).toBeNull();
    expect(roleFromEntraClaims(undefined)).toBeNull();
  });
  it("orders roles", () => {
    expect(hasRole("ADMIN", "EMPLOYEE")).toBe(true);
    expect(hasRole("EMPLOYEE", "ADMIN")).toBe(false);
  });
});
