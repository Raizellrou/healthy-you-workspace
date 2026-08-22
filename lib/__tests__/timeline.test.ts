import { describe, expect, it } from "vitest";
import { dailyCommitment, layoutBars, type TimelineTaskInput } from "@/lib/timeline";

function task(overrides: Partial<TimelineTaskInput> = {}): TimelineTaskInput {
  return {
    id: "t1",
    title: "Task",
    assignee_id: "e1",
    start_date: null,
    due_date: "2026-08-20",
    estimate_hours: null,
    priority: "medium",
    done: false,
    ...overrides,
  };
}

describe("layoutBars", () => {
  it("drops tasks with no due_date", () => {
    const bars = layoutBars([task({ id: "a", due_date: null })]);
    expect(bars).toHaveLength(0);
  });

  it("renders a task with no start_date as a single-day bar on its due date", () => {
    const [bar] = layoutBars([task({ id: "a", start_date: null, due_date: "2026-08-20" })]);
    expect(bar.start).toBe("2026-08-20");
    expect(bar.end).toBe("2026-08-20");
  });

  it("treats a start_date after the due_date the same as no start_date", () => {
    const [bar] = layoutBars([task({ id: "a", start_date: "2026-08-25", due_date: "2026-08-20" })]);
    expect(bar.start).toBe("2026-08-20");
  });

  it("packs non-overlapping bars into the same lane", () => {
    const bars = layoutBars([
      task({ id: "a", start_date: "2026-08-10", due_date: "2026-08-12" }),
      task({ id: "b", start_date: "2026-08-13", due_date: "2026-08-15" }),
    ]);
    expect(bars.find((b) => b.taskId === "a")?.lane).toBe(0);
    expect(bars.find((b) => b.taskId === "b")?.lane).toBe(0);
  });

  it("opens a new lane for overlapping bars", () => {
    const bars = layoutBars([
      task({ id: "a", start_date: "2026-08-10", due_date: "2026-08-15" }),
      task({ id: "b", start_date: "2026-08-12", due_date: "2026-08-14" }),
    ]);
    expect(bars.find((b) => b.taskId === "a")?.lane).toBe(0);
    expect(bars.find((b) => b.taskId === "b")?.lane).toBe(1);
  });

  it("reuses a freed lane once its previous bar has ended", () => {
    const bars = layoutBars([
      task({ id: "a", start_date: "2026-08-10", due_date: "2026-08-11" }),
      task({ id: "b", start_date: "2026-08-10", due_date: "2026-08-20" }), // overlaps a -> lane 1
      task({ id: "c", start_date: "2026-08-12", due_date: "2026-08-13" }), // a's lane (0) is free by now
    ]);
    expect(bars.find((b) => b.taskId === "c")?.lane).toBe(0);
  });
});

describe("dailyCommitment", () => {
  it("spreads a task's estimate evenly across the days it spans", () => {
    const totals = dailyCommitment(
      [task({ id: "a", start_date: "2026-08-10", due_date: "2026-08-12", estimate_hours: 9 })],
      "2026-08-10",
      "2026-08-12"
    );
    expect(totals.get("2026-08-10")).toBe(3);
    expect(totals.get("2026-08-11")).toBe(3);
    expect(totals.get("2026-08-12")).toBe(3);
  });

  it("clips a task's span to the requested range", () => {
    const totals = dailyCommitment(
      [task({ id: "a", start_date: "2026-08-08", due_date: "2026-08-12", estimate_hours: 10 })],
      "2026-08-10",
      "2026-08-12"
    );
    // Full 5-day span (08-12) divides the 10h into 2h/day; only the 3 days
    // inside the requested range appear in the result map.
    expect([...totals.keys()]).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
    expect(totals.get("2026-08-10")).toBe(2);
  });

  it("sums multiple tasks landing on the same day", () => {
    const totals = dailyCommitment(
      [
        task({ id: "a", due_date: "2026-08-10", estimate_hours: 4 }),
        task({ id: "b", due_date: "2026-08-10", estimate_hours: 2 }),
      ],
      "2026-08-10",
      "2026-08-10"
    );
    expect(totals.get("2026-08-10")).toBe(6);
  });

  it("excludes done tasks", () => {
    const totals = dailyCommitment(
      [task({ id: "a", due_date: "2026-08-10", estimate_hours: 8, done: true })],
      "2026-08-10",
      "2026-08-10"
    );
    expect(totals.get("2026-08-10")).toBe(0);
  });

  it("fills every day in the range with 0 even when nothing lands on it", () => {
    const totals = dailyCommitment([], "2026-08-10", "2026-08-12");
    expect([...totals.values()]).toEqual([0, 0, 0]);
  });
});
