import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInTz,
  daysBetween,
  eachDay,
  fmtDate,
  fmtDuration,
  fmtMinutes,
  isWeekend,
  isWithin,
  isoWeekday,
  minutesSinceMidnightInTz,
} from "@/lib/date";

describe("dateInTz", () => {
  it("returns the local calendar date, not the UTC one", () => {
    // 2026-08-18T15:30Z is already the 18th in UTC but the 18th at 23:30 in
    // Manila — same day here.
    const instant = new Date("2026-08-18T15:30:00Z");
    expect(dateInTz(instant, "Asia/Manila")).toBe("2026-08-18");
    expect(dateInTz(instant, "UTC")).toBe("2026-08-18");
  });

  it("is the bug this module exists to fix", () => {
    // 21:00 in Manila on the 18th is 13:00 UTC on the 18th — fine. But 23:00
    // Manila is 15:00 UTC *the same day*, while 08:00 Manila on the 19th is
    // 00:00 UTC on the 19th. The failure case is the other direction:
    // toISOString() on a late-evening Manila instant that has already rolled
    // over in UTC.
    const lateEvening = new Date("2026-08-18T16:10:00Z"); // 00:10 on the 19th in Manila
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-08-18");
    expect(dateInTz(lateEvening, "Asia/Manila")).toBe("2026-08-19");
  });

  it("handles negative offsets", () => {
    const instant = new Date("2026-08-19T02:00:00Z"); // 22:00 on the 18th in New York
    expect(instant.toISOString().slice(0, 10)).toBe("2026-08-19");
    expect(dateInTz(instant, "America/New_York")).toBe("2026-08-18");
  });
});

describe("minutesSinceMidnightInTz", () => {
  it("reports local wall-clock minutes", () => {
    const instant = new Date("2026-08-18T01:30:00Z");
    expect(minutesSinceMidnightInTz(instant, "UTC")).toBe(90);
    expect(minutesSinceMidnightInTz(instant, "Asia/Manila")).toBe(9 * 60 + 30);
  });

  it("reports midnight as 0, not 1440", () => {
    expect(minutesSinceMidnightInTz(new Date("2026-08-18T00:00:00Z"), "UTC")).toBe(0);
  });
});

describe("isoWeekday", () => {
  it("numbers Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday("2026-08-17")).toBe(1); // Monday
    expect(isoWeekday("2026-08-22")).toBe(6); // Saturday
    expect(isoWeekday("2026-08-23")).toBe(7); // Sunday
  });

  it("flags weekends", () => {
    expect(isWeekend("2026-08-21")).toBe(false); // Friday
    expect(isWeekend("2026-08-22")).toBe(true);
    expect(isWeekend("2026-08-23")).toBe(true);
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // 2026 is not a leap year
  });

  it("is unaffected by daylight-saving transitions", () => {
    // Parsing at UTC noon keeps a 23- or 25-hour local day from tipping the
    // result into an adjacent date.
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09"); // US DST start
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // US DST end
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("counts signed whole days", () => {
    expect(daysBetween("2026-08-18", "2026-08-25")).toBe(7);
    expect(daysBetween("2026-08-25", "2026-08-18")).toBe(-7);
    expect(daysBetween("2026-08-18", "2026-08-18")).toBe(0);
  });
});

describe("eachDay", () => {
  it("is inclusive at both ends", () => {
    expect(eachDay("2026-08-18", "2026-08-21")).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
  });

  it("returns a single day when start equals end", () => {
    expect(eachDay("2026-08-18", "2026-08-18")).toEqual(["2026-08-18"]);
  });

  it("returns nothing when the range is inverted", () => {
    expect(eachDay("2026-08-21", "2026-08-18")).toEqual([]);
  });
});

describe("isWithin", () => {
  it("includes both endpoints", () => {
    expect(isWithin("2026-08-18", "2026-08-18", "2026-08-20")).toBe(true);
    expect(isWithin("2026-08-20", "2026-08-18", "2026-08-20")).toBe(true);
    expect(isWithin("2026-08-21", "2026-08-18", "2026-08-20")).toBe(false);
  });
});

describe("formatters", () => {
  it("renders schedule minutes as 24-hour clock", () => {
    expect(fmtMinutes(540)).toBe("09:00");
    expect(fmtMinutes(1080)).toBe("18:00");
    expect(fmtMinutes(0)).toBe("00:00");
    expect(fmtMinutes(1440)).toBe("00:00");
  });

  it("renders a calendar date without shifting it", () => {
    expect(fmtDate("2026-08-18")).toBe("Tue 18 Aug");
  });

  it("renders elapsed time compactly", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(12 * 60_000)).toBe("12m");
    expect(fmtDuration((3 * 60 + 40) * 60_000)).toBe("3h 40m");
    expect(fmtDuration(-5000)).toBe("0m");
  });
});
