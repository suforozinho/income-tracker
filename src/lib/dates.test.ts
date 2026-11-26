import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  fromDbDate,
  isCalendarDate,
  monthKey,
  nextTaxPaymentDate,
  previousWeekday,
  toDbDate,
  todayInBrazil,
} from "./dates";

describe("todayInBrazil", () => {
  it("keeps a late-evening invoice on the 31st in that month", () => {
    // 23:30 in São Paulo on Jan 31 is 02:30 UTC on Feb 1.
    const lateOn31st = new Date("2026-02-01T02:30:00Z");
    expect(lateOn31st.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(todayInBrazil(lateOn31st)).toBe("2026-01-31");
    expect(monthKey(todayInBrazil(lateOn31st))).toBe("2026-01");
  });

  it("rolls over at midnight in Brazil, not in UTC", () => {
    expect(todayInBrazil(new Date("2026-02-01T02:59:59Z"))).toBe("2026-01-31");
    expect(todayInBrazil(new Date("2026-02-01T03:00:00Z"))).toBe("2026-02-01");
  });

  it("keeps the last evening of the year in that year", () => {
    expect(todayInBrazil(new Date("2027-01-01T01:00:00Z"))).toBe("2026-12-31");
  });
});

describe("database dates", () => {
  it("round-trips a calendar date through the @db.Date representation", () => {
    for (const d of ["2026-01-31", "2026-02-28", "2028-02-29", "2026-12-31"]) {
      expect(fromDbDate(toDbDate(d))).toBe(d);
    }
  });

  it("validates calendar dates", () => {
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("26-01-01")).toBe(false);
    expect(() => toDbDate("nope")).toThrow(RangeError);
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 30)).toBe("2027-01-30");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-25", "2026-12-02")).toBe(7);
  });

  it("formats dates in English", () => {
    expect(formatDate("2026-11-25")).toBe("Nov 25, 2026");
  });

  it("moves weekend dates back to Friday for rate lookups", () => {
    expect(previousWeekday("2026-11-21")).toBe("2026-11-20"); // Saturday
    expect(previousWeekday("2026-11-22")).toBe("2026-11-20"); // Sunday
    expect(previousWeekday("2026-11-23")).toBe("2026-11-23"); // Monday
  });
});

describe("nextTaxPaymentDate", () => {
  it("is the 20th when that is a weekday", () => {
    expect(nextTaxPaymentDate("2026-11-02")).toBe("2026-11-20"); // Friday
  });

  it("is the 20th itself on the day", () => {
    expect(nextTaxPaymentDate("2026-11-20")).toBe("2026-11-20");
  });

  it("moves to next month after the 20th", () => {
    expect(nextTaxPaymentDate("2026-11-25")).toBe("2026-12-21"); // Dec 20 is a Sunday
  });

  it("moves a Saturday 20th to Monday the 22nd", () => {
    expect(nextTaxPaymentDate("2026-06-01")).toBe("2026-06-22"); // Jun 20, 2026 is a Saturday
  });

  it("moves a Sunday 20th to Monday the 21st", () => {
    expect(nextTaxPaymentDate("2026-09-10")).toBe("2026-09-21"); // Sep 20, 2026 is a Sunday
  });

  it("stays on the moved Monday when today is the weekend 20th", () => {
    expect(nextTaxPaymentDate("2026-09-20")).toBe("2026-09-21");
  });

  it("rolls over the year", () => {
    expect(nextTaxPaymentDate("2026-12-28")).toBe("2027-01-20");
  });
});
