import { describe, expect, it } from "vitest";
import {
  avgNetHours,
  consecutiveWorkDays,
  daysSincePto,
  expandPtoDates,
  isOnPtoToday,
  lateClockOuts,
  netMinutes,
  noBreakDays,
  rollupDays,
  weekendWorkDays,
  type SessionBreakRow,
  type WorkSessionRow,
} from "@/lib/attendance";

function session(overrides: Partial<WorkSessionRow> = {}): WorkSessionRow {
  return {
    id: "s1",
    employee_id: "e1",
    clock_in: "2026-08-19T01:00:00Z",
    clock_out: "2026-08-19T09:00:00Z",
    work_date: "2026-08-19",
    ...overrides,
  };
}

function brk(overrides: Partial<SessionBreakRow> = {}): SessionBreakRow {
  return {
    id: "b1",
    session_id: "s1",
    break_start: "2026-08-19T05:00:00Z",
    break_end: "2026-08-19T05:30:00Z",
    ...overrides,
  };
}

describe("netMinutes", () => {
  it("is gross clocked time minus every break inside the session", () => {
    const s = session(); // 8h gross
    const breaks = [brk()]; // 30m
    expect(netMinutes(s, breaks)).toBe(450); // 7.5h
  });

  it("counts an open session up to `now`", () => {
    const s = session({ clock_out: null });
    const now = new Date("2026-08-19T03:00:00Z"); // 2h in
    expect(netMinutes(s, [], now)).toBe(120);
  });

  it("counts an open break up to `now`, not as zero-length", () => {
    const s = session(); // clocked out at 09:00, gross 8h
    const openBreak = brk({ break_end: null, break_start: "2026-08-19T05:00:00Z" });
    const now = new Date("2026-08-19T06:00:00Z"); // 1h into the still-open break
    expect(netMinutes(s, [openBreak], now)).toBe(420); // 480 - 60
  });

  it("ignores breaks belonging to a different session", () => {
    const s = session();
    const other = brk({ session_id: "other-session" });
    expect(netMinutes(s, [other])).toBe(480); // full 8h, no break subtracted
  });
});

describe("rollupDays", () => {
  it("sums multiple sessions on the same work_date into one row", () => {
    const sessions = [
      session({ id: "s1", clock_in: "2026-08-19T01:00:00Z", clock_out: "2026-08-19T05:00:00Z" }), // 4h
      session({ id: "s2", clock_in: "2026-08-19T06:00:00Z", clock_out: "2026-08-19T09:00:00Z" }), // 3h
    ];
    const [rollup] = rollupDays(sessions, []);
    expect(rollup.workDate).toBe("2026-08-19");
    expect(rollup.netHours).toBe(7);
    expect(rollup.sessionCount).toBe(2);
    expect(rollup.firstIn).toBe("2026-08-19T01:00:00Z");
    expect(rollup.lastOut).toBe("2026-08-19T09:00:00Z");
    expect(rollup.openSession).toBe(false);
  });

  it("flags a day with an unclosed session", () => {
    const [rollup] = rollupDays([session({ clock_out: null })], [], new Date("2026-08-19T03:00:00Z"));
    expect(rollup.openSession).toBe(true);
  });

  it("computes breakHours as gross minus net", () => {
    const [rollup] = rollupDays([session()], [brk()]);
    expect(rollup.grossHours).toBe(8);
    expect(rollup.breakHours).toBe(0.5);
    expect(rollup.netHours).toBe(7.5);
  });
});

describe("consecutiveWorkDays", () => {
  it("counts back from today while every weekday has net hours", () => {
    const rollups = [
      { workDate: "2026-08-19", netHours: 8 }, // Wed
      { workDate: "2026-08-20", netHours: 8 }, // Thu
      { workDate: "2026-08-21", netHours: 8 }, // Fri
    ];
    expect(consecutiveWorkDays(rollups, new Set(), "2026-08-21")).toBe(3);
  });

  it("skips weekends without breaking the streak", () => {
    const rollups = [
      { workDate: "2026-08-21", netHours: 8 }, // Fri
      { workDate: "2026-08-24", netHours: 8 }, // Mon
    ];
    // 2026-08-22/23 are Sat/Sun — skipped, not gaps.
    expect(consecutiveWorkDays(rollups, new Set(), "2026-08-24")).toBe(2);
  });

  it("stops at the first weekday with zero hours", () => {
    const rollups = [
      { workDate: "2026-08-19", netHours: 8 },
      { workDate: "2026-08-21", netHours: 8 }, // 20th missing — gap
    ];
    expect(consecutiveWorkDays(rollups, new Set(), "2026-08-21")).toBe(1);
  });

  it("stops at a date covered by approved PTO", () => {
    const rollups = [
      { workDate: "2026-08-20", netHours: 8 },
      { workDate: "2026-08-21", netHours: 8 },
    ];
    expect(consecutiveWorkDays(rollups, new Set(["2026-08-19"]), "2026-08-21")).toBe(2);
  });

  it("is 0 when today has no session yet", () => {
    const rollups = [{ workDate: "2026-08-20", netHours: 8 }];
    expect(consecutiveWorkDays(rollups, new Set(), "2026-08-21")).toBe(0);
  });
});

describe("avgNetHours", () => {
  it("averages the given rollup window", () => {
    expect(avgNetHours([{ netHours: 8 }, { netHours: 6 }, { netHours: 7 }])).toBe(7);
  });

  it("is 0 for an empty window", () => {
    expect(avgNetHours([])).toBe(0);
  });
});

describe("lateClockOuts", () => {
  it("counts days whose last clock-out is at/after the work-window end, in the given timezone", () => {
    const rollups = [
      { lastOut: "2026-08-19T12:00:00Z" }, // 20:00 Asia/Manila (UTC+8) — late
      { lastOut: "2026-08-19T09:00:00Z" }, // 17:00 Manila — on time
      { lastOut: null },
    ];
    expect(lateClockOuts(rollups, "Asia/Manila")).toBe(1);
  });
});

describe("weekendWorkDays", () => {
  it("counts only Sat/Sun rows with real hours", () => {
    const rollups = [
      { workDate: "2026-08-22", netHours: 3 }, // Saturday
      { workDate: "2026-08-23", netHours: 0 }, // Sunday, no hours
      { workDate: "2026-08-24", netHours: 8 }, // Monday
    ];
    expect(weekendWorkDays(rollups)).toBe(1);
  });
});

describe("noBreakDays", () => {
  it("counts long days with zero recorded break time", () => {
    const rollups = [
      { netHours: 6, breakHours: 0 }, // long, no break
      { netHours: 6, breakHours: 0.5 }, // long, took a break
      { netHours: 3, breakHours: 0 }, // short — doesn't count
    ];
    expect(noBreakDays(rollups)).toBe(1);
  });
});

describe("expandPtoDates / isOnPtoToday / daysSincePto", () => {
  const pto = [
    { start_date: "2026-08-10", end_date: "2026-08-12", status: "approved" },
    { start_date: "2026-08-15", end_date: "2026-08-15", status: "pending" }, // not approved — ignored
  ];

  it("expands only approved ranges into individual dates", () => {
    const dates = expandPtoDates(pto);
    expect(dates.has("2026-08-10")).toBe(true);
    expect(dates.has("2026-08-11")).toBe(true);
    expect(dates.has("2026-08-12")).toBe(true);
    expect(dates.has("2026-08-15")).toBe(false);
  });

  it("isOnPtoToday matches inside an approved range only", () => {
    expect(isOnPtoToday(pto, "2026-08-11")).toBe(true);
    expect(isOnPtoToday(pto, "2026-08-15")).toBe(false);
  });

  it("daysSincePto counts from the most recent approved end date", () => {
    expect(daysSincePto(pto, "2026-08-20")).toBe(8); // 12th -> 20th
  });

  it("falls back to the window length when no approved PTO exists in it", () => {
    expect(daysSincePto([], "2026-08-20", 90)).toBe(90);
  });
});
