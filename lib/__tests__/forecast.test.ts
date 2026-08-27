import { describe, it, expect } from "vitest";
import { forecastNext7Days } from "@/lib/forecast";
import { computeBurnoutV2, type BurnoutV2Extras } from "@/lib/burnout-signals";
import type { BurnoutInputs } from "@/lib/burnout";

const BASE_INPUTS: BurnoutInputs = {
  streakDays: 2,
  meetingAvg: 3,
  available: 8,
  offHoursWeekly: 2,
  daysSincePto: 10,
  onPto: false,
};

const BASE_EXTRAS: BurnoutV2Extras = {
  committedHours: 20,
  weeklyCapacityHours: 40,
  overdueTaskCount: 1,
  noBreakDayCount: 1,
  weekendWorkDayCount: 0,
  avgNetHours: 8,
};

const FLAT_7 = () => Array(7).fill(0);

describe("forecastNext7Days", () => {
  it("returns one point per day, in order, dayOffset 1..7", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    expect(points).toHaveLength(7);
    expect(points.map((p) => p.dayOffset)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("marks the first 3 days high confidence and the rest medium", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    expect(points.slice(0, 3).every((p) => p.confidence === "high")).toBe(true);
    expect(points.slice(3).every((p) => p.confidence === "medium")).toBe(true);
  });

  it("a heavy meeting day scores higher than a light meeting day", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: [0, 7, 0, 0, 0, 0, 0],
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    expect(points[1].compositeV2).toBeGreaterThan(points[0].compositeV2);
    expect(points[1].compositeV2).toBeGreaterThan(points[2].compositeV2);
  });

  it("PTO on a day resets daysSincePto, lowering that day's score versus an identical non-PTO day", () => {
    const withoutPto = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    const withPto = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: [false, false, true, false, false, false, false],
      weeklyCapacityHours: 40,
    });
    expect(withPto[2].compositeV2).toBeLessThan(withoutPto[2].compositeV2);
  });

  it("a task due on day N shows up as overdue starting day N+1, not day N itself", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: { ...BASE_EXTRAS, overdueTaskCount: 0 },
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: [0, 3, 0, 0, 0, 0, 0], // 3 tasks due on day 2
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    // Day 2 (index 1) itself shouldn't count them as overdue yet.
    const day2Scores = computeBurnoutV2(
      { ...BASE_INPUTS, meetingAvg: 0, daysSincePto: 12, onPto: false },
      { ...BASE_EXTRAS, overdueTaskCount: 0, weeklyCapacityHours: 40 }
    );
    expect(points[1].compositeV2).toBe(Math.round(day2Scores.compositeV2));
    // Day 3 (index 2) should now carry those 3 as overdue, scoring higher.
    expect(points[2].compositeV2).toBeGreaterThan(points[1].compositeV2);
  });

  it("overdue count accumulates across days rather than resetting", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: { ...BASE_EXTRAS, overdueTaskCount: 0 },
      upcomingMeetingHours: FLAT_7(),
      upcomingDueTasks: [1, 1, 1, 0, 0, 0, 0],
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    // Overdue-driven score should climb monotonically through day 4 as
    // each prior day's due task rolls into "now overdue".
    expect(points[1].compositeV2).toBeGreaterThanOrEqual(points[0].compositeV2);
    expect(points[2].compositeV2).toBeGreaterThanOrEqual(points[1].compositeV2);
    expect(points[3].compositeV2).toBeGreaterThanOrEqual(points[2].compositeV2);
  });

  it("truncates to the shortest input array rather than throwing", () => {
    const points = forecastNext7Days({
      inputs: BASE_INPUTS,
      extras: BASE_EXTRAS,
      upcomingMeetingHours: [0, 0, 0],
      upcomingDueTasks: FLAT_7(),
      ptoScheduled: Array(7).fill(false),
      weeklyCapacityHours: 40,
    });
    expect(points).toHaveLength(3);
  });
});
