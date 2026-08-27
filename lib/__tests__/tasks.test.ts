import { describe, expect, it } from "vitest";
import {
  buildCapacityWorkload,
  capacityLoad,
  dueWithin,
  estimateOrDefault,
  filterTasks,
  isOffHoursMoment,
  overdueCount,
} from "@/lib/tasks";
import type { Task } from "@/types/task";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    project_id: "p1",
    section_id: null,
    title: "Ship the thing",
    description: null,
    assignee_id: null,
    created_by: "e1",
    priority: "medium",
    due_date: null,
    done: false,
    position: 0,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("estimateOrDefault", () => {
  it("uses the explicit estimate when one is set", () => {
    expect(estimateOrDefault({ estimate_hours: 6, priority: "low" })).toBe(6);
  });

  it("falls back to a priority-based default when unset", () => {
    expect(estimateOrDefault({ estimate_hours: null, priority: "high" })).toBe(4);
    expect(estimateOrDefault({ estimate_hours: null, priority: "medium" })).toBe(2);
    expect(estimateOrDefault({ estimate_hours: null, priority: "low" })).toBe(1);
  });

  it("treats an explicit zero as a real estimate, not 'unset'", () => {
    expect(estimateOrDefault({ estimate_hours: 0, priority: "high" })).toBe(0);
  });
});

describe("capacityLoad", () => {
  it("computes committed hours as a percentage of capacity", () => {
    expect(capacityLoad(20, 40)).toBe(50);
    expect(capacityLoad(40, 40)).toBe(100);
  });

  it("is uncapped above 100%, not clamped", () => {
    expect(capacityLoad(60, 40)).toBe(150);
  });

  it("returns 0 rather than dividing by a zero/blank capacity", () => {
    expect(capacityLoad(20, 0)).toBe(0);
  });
});

describe("overdueCount", () => {
  const REAL_DATE_NOW = Date.now;
  const FIXED_NOW = new Date("2026-08-22T12:00:00Z").getTime();

  it("counts only open tasks with a due_date in the past", () => {
    Date.now = () => FIXED_NOW;
    try {
      const tasks = [
        { done: false, due_date: "2026-08-20" }, // overdue
        { done: false, due_date: "2026-08-25" }, // not yet due
        { done: true, due_date: "2026-08-19" }, // done — doesn't count
        { done: false, due_date: null }, // no due date — doesn't count
      ];
      expect(overdueCount(tasks)).toBe(1);
    } finally {
      Date.now = REAL_DATE_NOW;
    }
  });
});

describe("dueWithin", () => {
  const today = "2026-08-22";

  it("includes open tasks due today through the cutoff, inclusive", () => {
    const tasks = [
      { done: false, due_date: "2026-08-22" }, // today
      { done: false, due_date: "2026-08-25" }, // within 3 days
      { done: false, due_date: "2026-08-26" }, // outside 3 days
      { done: false, due_date: "2026-08-20" }, // already past — excluded
      { done: true, due_date: "2026-08-23" }, // done — excluded
      { done: false, due_date: null }, // no due date — excluded
    ];
    const result = dueWithin(tasks, 3, today);
    expect(result.map((t) => t.due_date)).toEqual(["2026-08-22", "2026-08-25"]);
  });
});

describe("buildCapacityWorkload", () => {
  const people = [
    { id: "p1", name: "Alex", avatarColor: "#111", weeklyCapacityHours: 40 },
    { id: "p2", name: "Sam", avatarColor: "#222", weeklyCapacityHours: 20 },
    { id: "p3", name: "Robin", avatarColor: "#333", weeklyCapacityHours: 40 },
  ];

  it("sums estimateOrDefault per assignee and computes load_pct against their own capacity", () => {
    const tasks = [
      { assignee_id: "p1", priority: "high" as const, done: false, estimate_hours: null, due_date: null }, // 4h default
      { assignee_id: "p1", priority: "low" as const, done: false, estimate_hours: null, due_date: null }, // 1h default
      { assignee_id: "p2", priority: "medium" as const, done: false, estimate_hours: 15, due_date: null },
      { assignee_id: "p2", priority: "low" as const, done: true, estimate_hours: 99, due_date: null }, // done — excluded
    ];
    const result = buildCapacityWorkload(tasks, people);

    const p1 = result.find((e) => e.employee_id === "p1")!;
    expect(p1.committed_hours).toBe(5);
    expect(p1.load_pct).toBe(13); // round(5/40*100)

    const p2 = result.find((e) => e.employee_id === "p2")!;
    expect(p2.committed_hours).toBe(15);
    expect(p2.load_pct).toBe(75);

    // Robin has no open tasks — filtered out entirely, not shown at 0%.
    expect(result.find((e) => e.employee_id === "p3")).toBeUndefined();
  });

  it("sorts by load_pct descending, not by raw open count", () => {
    const tasks = [
      { assignee_id: "p1", priority: "low" as const, done: false, estimate_hours: 4, due_date: null },
      { assignee_id: "p2", priority: "low" as const, done: false, estimate_hours: 18, due_date: null },
    ];
    const result = buildCapacityWorkload(tasks, people);
    expect(result.map((e) => e.employee_id)).toEqual(["p2", "p1"]); // 90% before 10%
  });

  it("counts overdue open tasks per assignee", () => {
    const tasks = [
      { assignee_id: "p1", priority: "low" as const, done: false, estimate_hours: 1, due_date: "2000-01-01" },
      { assignee_id: "p1", priority: "low" as const, done: false, estimate_hours: 1, due_date: "2999-01-01" },
    ];
    const result = buildCapacityWorkload(tasks, people);
    expect(result.find((e) => e.employee_id === "p1")?.overdue_count).toBe(1);
  });
});

describe("isOffHoursMoment", () => {
  const TZ = "Asia/Manila"; // UTC+8, no DST

  it("is false during the standard work window on a weekday", () => {
    // 2026-08-19 is a Wednesday. 10:00 Manila = 02:00 UTC.
    expect(isOffHoursMoment(new Date("2026-08-19T02:00:00Z"), TZ)).toBe(false);
  });

  it("is true before the work window starts", () => {
    // 07:00 Manila = 2026-08-18T23:00:00Z (still Tue in Manila).
    expect(isOffHoursMoment(new Date("2026-08-18T23:00:00Z"), TZ)).toBe(true);
  });

  it("is true after the work window ends", () => {
    // 20:00 Manila = 12:00 UTC.
    expect(isOffHoursMoment(new Date("2026-08-19T12:00:00Z"), TZ)).toBe(true);
  });

  it("is true on a weekend regardless of the hour", () => {
    // 2026-08-22 is a Saturday. 10:00 Manila = 02:00 UTC.
    expect(isOffHoursMoment(new Date("2026-08-22T02:00:00Z"), TZ)).toBe(true);
  });
});

describe("filterTasks", () => {
  const tasks = [
    task({ id: "a", title: "Finalize pricing page copy", assignee_id: "amara", priority: "high" }),
    task({ id: "b", title: "QA the checkout flow", description: "cross-browser pass", assignee_id: "beatriz", priority: "medium" }),
    task({ id: "c", title: "Write launch announcement", assignee_id: "amara", priority: "low", labels: [{ id: "l1", name: "Launch", color: "#000" }] }),
  ];

  it("matches search text against title or description, case-insensitively", () => {
    expect(filterTasks(tasks, { q: "pricing" }).map((t) => t.id)).toEqual(["a"]);
    expect(filterTasks(tasks, { q: "CROSS-BROWSER" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("filters by assignee", () => {
    expect(filterTasks(tasks, { assigneeId: "amara" }).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("filters by priority", () => {
    expect(filterTasks(tasks, { priority: "low" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("filters by label", () => {
    expect(filterTasks(tasks, { labelId: "l1" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("combines filters with AND", () => {
    expect(filterTasks(tasks, { assigneeId: "amara", priority: "low" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("returns everything when no filters are set", () => {
    expect(filterTasks(tasks, {})).toHaveLength(3);
  });
});
