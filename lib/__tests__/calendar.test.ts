import { describe, expect, it } from "vitest";
import { hoursDueByDate, loadBand, monthGrid } from "@/lib/calendar";

describe("monthGrid", () => {
  it("returns 42 cells (6x7), Monday-start", () => {
    // 2026-08-01 is a Saturday.
    const cells = monthGrid(2026, 8, "2026-08-01");
    expect(cells).toHaveLength(42);
    expect(cells[0].date).toBe("2026-07-27"); // Monday of that week
  });

  it("flags cells outside the target month", () => {
    const cells = monthGrid(2026, 8, "2026-08-01");
    expect(cells[0].inMonth).toBe(false); // 2026-07-27
    expect(cells.find((c) => c.date === "2026-08-15")?.inMonth).toBe(true);
  });

  it("flags weekends and today", () => {
    const cells = monthGrid(2026, 8, "2026-08-22");
    const aug22 = cells.find((c) => c.date === "2026-08-22")!; // Saturday
    expect(aug22.isWeekend).toBe(true);
    expect(aug22.isToday).toBe(true);
    const aug19 = cells.find((c) => c.date === "2026-08-19")!; // Wednesday
    expect(aug19.isWeekend).toBe(false);
    expect(aug19.isToday).toBe(false);
  });

  it("always starts on a Monday regardless of what day the 1st falls on", () => {
    // 2026-09-01 is a Tuesday.
    const cells = monthGrid(2026, 9, "2026-09-01");
    expect(cells[0].date).toBe("2026-08-31");
  });
});

describe("loadBand", () => {
  it("bands hours into none/light/busy/overloaded", () => {
    expect(loadBand(0)).toBe("none");
    expect(loadBand(2)).toBe("light");
    expect(loadBand(4)).toBe("busy");
    expect(loadBand(8)).toBe("busy");
    expect(loadBand(8.5)).toBe("overloaded");
  });
});

describe("hoursDueByDate", () => {
  it("sums estimateOrDefault per due date, open tasks only", () => {
    const tasks = [
      { due_date: "2026-08-20", done: false, priority: "high" as const, estimate_hours: null }, // 4h default
      { due_date: "2026-08-20", done: false, priority: "low" as const, estimate_hours: 2 },
      { due_date: "2026-08-21", done: false, priority: "medium" as const, estimate_hours: null }, // 2h default
      { due_date: "2026-08-20", done: true, priority: "high" as const, estimate_hours: 99 }, // done — excluded
      { due_date: null, done: false, priority: "high" as const, estimate_hours: 99 }, // no due date — excluded
    ];
    const totals = hoursDueByDate(tasks);
    expect(totals.get("2026-08-20")).toBe(6);
    expect(totals.get("2026-08-21")).toBe(2);
    expect(totals.has("2026-08-19")).toBe(false);
  });
});
