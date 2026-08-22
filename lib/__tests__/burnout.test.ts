import { describe, expect, it } from "vitest";
import { bandFor, computeBurnout, dominantDriver, sparkPath } from "@/lib/burnout";
import type { BurnoutInputs } from "@/lib/burnout";

/**
 * Characterization tests for `lib/burnout.ts`.
 *
 * That module is on the must-not-modify list in AGENTS.md, and the plan is to
 * extend it by composition (`lib/burnout-signals.ts` imports `computeBurnout`
 * and `bandFor` and layers task/recovery factors on top). These tests pin the
 * current numbers so that when the *inputs* start coming from real clock data
 * instead of `daily_activity`, any change in the score is a change we chose.
 *
 * They assert what the code does today, not what it ideally should — including
 * the rough edges noted below. Do not "fix" a failing expectation here without
 * deciding first whether the behaviour change was intentional.
 */

function inputs(overrides: Partial<BurnoutInputs> = {}): BurnoutInputs {
  return {
    streakDays: 0,
    meetingAvg: 0,
    available: 8,
    offHoursWeekly: 0,
    daysSincePto: 0,
    onPto: false,
    ...overrides,
  };
}

describe("bandFor", () => {
  it("uses inclusive lower bounds at each threshold", () => {
    expect(bandFor(0)).toBe("low");
    expect(bandFor(24.99)).toBe("low");
    expect(bandFor(25)).toBe("medium");
    expect(bandFor(49.99)).toBe("medium");
    expect(bandFor(50)).toBe("high");
    expect(bandFor(74.99)).toBe("high");
    expect(bandFor(75)).toBe("critical");
    expect(bandFor(100)).toBe("critical");
  });
});

describe("computeBurnout — individual drivers", () => {
  it("scores a fully idle person at zero", () => {
    const scores = computeBurnout(inputs());
    expect(scores).toMatchObject({
      streak: 0,
      meeting: 0,
      offHours: 0,
      pto: 0,
      composite: 0,
      band: "low",
    });
  });

  it("scales streak at 8 points per consecutive day and caps at 100", () => {
    expect(computeBurnout(inputs({ streakDays: 5 })).streak).toBe(40);
    expect(computeBurnout(inputs({ streakDays: 12 })).streak).toBe(96);
    expect(computeBurnout(inputs({ streakDays: 13 })).streak).toBe(100);
    expect(computeBurnout(inputs({ streakDays: 40 })).streak).toBe(100);
  });

  it("scores meetings as a share of available hours", () => {
    expect(computeBurnout(inputs({ meetingAvg: 2, available: 8 })).meeting).toBe(25);
    expect(computeBurnout(inputs({ meetingAvg: 6, available: 8 })).meeting).toBe(75);
    expect(computeBurnout(inputs({ meetingAvg: 9, available: 8 })).meeting).toBe(100);
  });

  it("treats a smaller available-hours denominator as more pressure", () => {
    // This is exactly why P4 swaps `available` from the fixed `available_hours`
    // column to actual clocked hours: the same meeting load reads very
    // differently against a real 6.5h day.
    const fixed = computeBurnout(inputs({ meetingAvg: 5, available: 8 })).meeting;
    const clocked = computeBurnout(inputs({ meetingAvg: 5, available: 6.5 })).meeting;
    expect(fixed).toBeCloseTo(62.5, 5);
    expect(clocked).toBeCloseTo(76.923, 3);
    expect(clocked).toBeGreaterThan(fixed);
  });

  it("treats 15 off-hours messages a week as the ceiling", () => {
    expect(computeBurnout(inputs({ offHoursWeekly: 3 })).offHours).toBe(20);
    expect(computeBurnout(inputs({ offHoursWeekly: 15 })).offHours).toBe(100);
    expect(computeBurnout(inputs({ offHoursWeekly: 30 })).offHours).toBe(100);
  });

  it("ramps PTO pressure over 120 days", () => {
    expect(computeBurnout(inputs({ daysSincePto: 60 })).pto).toBe(50);
    expect(computeBurnout(inputs({ daysSincePto: 120 })).pto).toBe(100);
    expect(computeBurnout(inputs({ daysSincePto: 300 })).pto).toBe(100);
  });

  it("adds a 30-point penalty for working through PTO", () => {
    const resting = computeBurnout(inputs({ daysSincePto: 12, onPto: true, offHoursWeekly: 0 }));
    const working = computeBurnout(inputs({ daysSincePto: 12, onPto: true, offHoursWeekly: 1 }));
    expect(resting.pto).toBe(10);
    expect(working.pto).toBe(40);
  });

  it("applies no PTO penalty when off-hours messages exist but the person is not on PTO", () => {
    expect(computeBurnout(inputs({ daysSincePto: 12, onPto: false, offHoursWeekly: 9 })).pto).toBe(10);
  });
});

describe("computeBurnout — composite", () => {
  it("weights the drivers 30 / 25 / 25 / 20", () => {
    expect(computeBurnout(inputs({ streakDays: 13 })).composite).toBeCloseTo(30, 5);
    expect(computeBurnout(inputs({ meetingAvg: 8, available: 8 })).composite).toBeCloseTo(25, 5);
    expect(computeBurnout(inputs({ offHoursWeekly: 15 })).composite).toBeCloseTo(25, 5);
    expect(computeBurnout(inputs({ daysSincePto: 120 })).composite).toBeCloseTo(20, 5);
  });

  it("scores a realistic at-risk profile in the high band", () => {
    const scores = computeBurnout(
      inputs({ streakDays: 11, meetingAvg: 5.2, available: 8, offHoursWeekly: 9, daysSincePto: 96 })
    );
    // 0.3(88) + 0.25(65) + 0.25(60) + 0.2(80)
    expect(scores.composite).toBeCloseTo(73.65, 2);
    expect(scores.band).toBe("high");
  });

  it("silently maxes out the meeting driver when available hours are zero", () => {
    // Documented rough edge, and a trap for P4: there is no zero-guard on the
    // divisor. A positive meeting load over zero available hours is Infinity,
    // which `Math.min(100, …)` clamps to a perfect 100 — so a data gap reads
    // as maximum meeting pressure rather than as missing data.
    const scores = computeBurnout(inputs({ meetingAvg: 3, available: 0 }));
    expect(scores.meeting).toBe(100);
    expect(Number.isNaN(scores.composite)).toBe(false);
  });

  it("returns NaN only when both meeting hours and available hours are zero", () => {
    // 0 / 0 is the one path that actually poisons the composite. `queries.ts`
    // guards it with `available_hours || 8`; anything feeding clocked hours in
    // P4 has to do the same.
    const scores = computeBurnout(inputs({ meetingAvg: 0, available: 0 }));
    expect(Number.isNaN(scores.meeting)).toBe(true);
    expect(Number.isNaN(scores.composite)).toBe(true);
  });
});

describe("dominantDriver", () => {
  it("names the highest-scoring driver", () => {
    const scores = computeBurnout(inputs({ streakDays: 12, offHoursWeekly: 2 }));
    expect(dominantDriver(scores).key).toBe("streak");
  });

  it("breaks ties in declaration order: streak, meeting, offHours, pto", () => {
    // Array.prototype.sort is stable, so equal values keep their listed order.
    const tied = { streak: 50, meeting: 50, offHours: 50, pto: 50, composite: 50, band: "high" } as const;
    expect(dominantDriver(tied).key).toBe("streak");
    expect(dominantDriver({ ...tied, streak: 0 }).key).toBe("meeting");
    expect(dominantDriver({ ...tied, streak: 0, meeting: 0 }).key).toBe("offHours");
    expect(dominantDriver({ ...tied, streak: 0, meeting: 0, offHours: 0 }).key).toBe("pto");
  });
});

describe("sparkPath", () => {
  it("returns an empty string for no data", () => {
    expect(sparkPath([])).toBe("");
  });

  it("pins a single point at the left edge", () => {
    expect(sparkPath([50], 120, 36)).toBe("M0.00 18.00");
  });

  it("maps 0 to the bottom and 100 to the top of the box", () => {
    expect(sparkPath([0, 100], 120, 36)).toBe("M0.00 36.00 L120.00 0.00");
  });
});
