import { describe, expect, it } from "vitest";
import { computeBurnout } from "@/lib/burnout";
import {
  computeBurnoutV2,
  computeV2Factors,
  dominantDriverV2,
  toBurnoutInputs,
  type BurnoutV2Extras,
} from "@/lib/burnout-signals";

describe("toBurnoutInputs", () => {
  it("uses avgNetHours as `available` when real session history exists", () => {
    const inputs = toBurnoutInputs({
      meetingAvg: 3,
      fallbackAvailable: 8,
      streakDays: 5,
      avgNetHours: 6.5,
      offHoursWeekly: 2,
      daysSincePto: 10,
      onPto: false,
    });
    expect(inputs.available).toBe(6.5);
  });

  it("falls back to the daily_activity-derived value when there's no session history", () => {
    const inputs = toBurnoutInputs({
      meetingAvg: 3,
      fallbackAvailable: 8,
      streakDays: 0,
      avgNetHours: 0,
      offHoursWeekly: 0,
      daysSincePto: 0,
      onPto: false,
    });
    expect(inputs.available).toBe(8);
  });

  it("falls back when avgNetHours is a near-zero sliver, not just literally zero", () => {
    // Regression: someone who clocked in moments ago has avgNetHours ≈ 0.02.
    // Treating that as real `available` sent meetingAvg/available toward
    // infinity and pinned the meeting factor at 100 on a live account.
    const inputs = toBurnoutInputs({
      meetingAvg: 3,
      fallbackAvailable: 8,
      streakDays: 0,
      avgNetHours: 0.02,
      offHoursWeekly: 0,
      daysSincePto: 0,
      onPto: false,
    });
    expect(inputs.available).toBe(8);
  });

  it("trusts avgNetHours once it reflects at least an hour of real clocked time", () => {
    const inputs = toBurnoutInputs({
      meetingAvg: 3,
      fallbackAvailable: 8,
      streakDays: 0,
      avgNetHours: 1,
      offHoursWeekly: 0,
      daysSincePto: 0,
      onPto: false,
    });
    expect(inputs.available).toBe(1);
  });

  it("passes streak/offHours/PTO signals through untouched", () => {
    const inputs = toBurnoutInputs({
      meetingAvg: 3,
      fallbackAvailable: 8,
      streakDays: 12,
      avgNetHours: 7,
      offHoursWeekly: 4,
      daysSincePto: 40,
      onPto: true,
    });
    expect(inputs.streakDays).toBe(12);
    expect(inputs.offHoursWeekly).toBe(4);
    expect(inputs.daysSincePto).toBe(40);
    expect(inputs.onPto).toBe(true);
  });
});

describe("computeV2Factors", () => {
  const base: BurnoutV2Extras = {
    committedHours: 0,
    weeklyCapacityHours: 40,
    overdueTaskCount: 0,
    noBreakDayCount: 0,
    weekendWorkDayCount: 0,
    avgNetHours: 7,
  };

  it("taskLoad is committed hours as % of weekly capacity", () => {
    expect(computeV2Factors({ ...base, committedHours: 20 }).taskLoad).toBe(50);
  });

  it("overdue is 20 points per overdue task, capped at 100", () => {
    expect(computeV2Factors({ ...base, overdueTaskCount: 3 }).overdue).toBe(60);
    expect(computeV2Factors({ ...base, overdueTaskCount: 10 }).overdue).toBe(100);
  });

  it("recovery combines no-break days, weekend days, and a long-average-hours penalty", () => {
    expect(computeV2Factors({ ...base, noBreakDayCount: 2 }).recovery).toBe(30); // 2*15
    expect(computeV2Factors({ ...base, weekendWorkDayCount: 1 }).recovery).toBe(20); // 1*20
    expect(computeV2Factors({ ...base, avgNetHours: 10 }).recovery).toBe(25); // >9.5h
    expect(computeV2Factors({ ...base, avgNetHours: 9 }).recovery).toBe(0); // not over threshold
  });

  it("recovery is capped at 100", () => {
    expect(
      computeV2Factors({ ...base, noBreakDayCount: 5, weekendWorkDayCount: 3, avgNetHours: 11 }).recovery
    ).toBe(100);
  });
});

describe("computeBurnoutV2", () => {
  const inputs = { streakDays: 5, meetingAvg: 3, available: 8, offHoursWeekly: 2, daysSincePto: 10, onPto: false };
  const zeroExtras: BurnoutV2Extras = {
    committedHours: 0,
    weeklyCapacityHours: 40,
    overdueTaskCount: 0,
    noBreakDayCount: 0,
    weekendWorkDayCount: 0,
    avgNetHours: 7,
  };

  it("reduces to 0.7x the base composite when every v2 factor is 0", () => {
    const base = computeBurnout(inputs);
    const v2 = computeBurnoutV2(inputs, zeroExtras);
    expect(v2.compositeV2).toBeCloseTo(0.7 * base.composite, 5);
    expect(v2.bandV2).toBe(v2.compositeV2 >= 75 ? "critical" : v2.compositeV2 >= 50 ? "high" : v2.compositeV2 >= 25 ? "medium" : "low");
  });

  it("leaves the base scores (streak/meeting/offHours/pto/composite/band) untouched", () => {
    const base = computeBurnout(inputs);
    const v2 = computeBurnoutV2(inputs, zeroExtras);
    expect(v2.streak).toBe(base.streak);
    expect(v2.meeting).toBe(base.meeting);
    expect(v2.offHours).toBe(base.offHours);
    expect(v2.pto).toBe(base.pto);
    expect(v2.composite).toBe(base.composite);
    expect(v2.band).toBe(base.band);
  });

  it("a heavy task load pushes compositeV2 above the base composite", () => {
    const base = computeBurnout(inputs);
    const heavy = computeBurnoutV2(inputs, { ...zeroExtras, committedHours: 60, overdueTaskCount: 4 });
    expect(heavy.compositeV2).toBeGreaterThan(0.7 * base.composite);
  });
});

describe("dominantDriverV2", () => {
  const flatInputs = { streakDays: 0, meetingAvg: 0, available: 8, offHoursWeekly: 0, daysSincePto: 0, onPto: false };

  it("names a v2 factor when it out-scores every base factor", () => {
    const scores = computeBurnoutV2(flatInputs, {
      committedHours: 40,
      weeklyCapacityHours: 40,
      overdueTaskCount: 0,
      noBreakDayCount: 0,
      weekendWorkDayCount: 0,
      avgNetHours: 7,
    });
    expect(dominantDriverV2(scores).key).toBe("taskLoad");
  });

  it("delegates to the base dominant driver when it out-scores every v2 factor", () => {
    const scores = computeBurnoutV2(
      { streakDays: 20, meetingAvg: 0, available: 8, offHoursWeekly: 0, daysSincePto: 0, onPto: false },
      {
        committedHours: 0,
        weeklyCapacityHours: 40,
        overdueTaskCount: 0,
        noBreakDayCount: 0,
        weekendWorkDayCount: 0,
        avgNetHours: 7,
      }
    );
    expect(dominantDriverV2(scores).key).toBe("streak");
  });
});
