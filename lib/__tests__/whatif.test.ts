import { describe, it, expect } from "vitest";
import { applyWhatIf, EMPTY_ADJUSTMENTS } from "@/lib/whatif";
import { computeBurnoutV2 } from "@/lib/burnout-signals";
import type { BurnoutInputs } from "@/lib/burnout";
import type { BurnoutV2Extras } from "@/lib/burnout-signals";

const INPUTS: BurnoutInputs = {
  streakDays: 10,
  meetingAvg: 4,
  available: 8,
  offHoursWeekly: 6,
  daysSincePto: 40,
  onPto: false,
};

const EXTRAS: BurnoutV2Extras = {
  committedHours: 50,
  weeklyCapacityHours: 40,
  overdueTaskCount: 3,
  noBreakDayCount: 2,
  weekendWorkDayCount: 1,
  avgNetHours: 9,
};

describe("applyWhatIf", () => {
  it("with no adjustments, returns equivalent inputs/extras", () => {
    const result = applyWhatIf(INPUTS, EXTRAS, EMPTY_ADJUSTMENTS);
    expect(result.inputs).toEqual(INPUTS);
    expect(result.extras).toEqual(EXTRAS);
  });

  it("subtracts daysOff from streakDays, floored at 0", () => {
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, daysOff: 3 }).inputs.streakDays).toBe(7);
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, daysOff: 99 }).inputs.streakDays).toBe(0);
  });

  it("subtracts hoursMoved from committedHours, floored at 0", () => {
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, hoursMoved: 20 }).extras.committedHours).toBe(30);
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, hoursMoved: 999 }).extras.committedHours).toBe(0);
  });

  it("subtracts overdueResolved from overdueTaskCount, floored at 0", () => {
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, overdueResolved: 2 }).extras.overdueTaskCount).toBe(1);
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, overdueResolved: 10 }).extras.overdueTaskCount).toBe(0);
  });

  it("subtracts offHoursReduced from offHoursWeekly, floored at 0", () => {
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, offHoursReduced: 4 }).inputs.offHoursWeekly).toBe(2);
    expect(applyWhatIf(INPUTS, EXTRAS, { ...EMPTY_ADJUSTMENTS, offHoursReduced: 999 }).inputs.offHoursWeekly).toBe(0);
  });

  it("leaves every other field untouched", () => {
    const result = applyWhatIf(INPUTS, EXTRAS, { daysOff: 2, hoursMoved: 10, overdueResolved: 1, offHoursReduced: 1 });
    expect(result.inputs.meetingAvg).toBe(INPUTS.meetingAvg);
    expect(result.inputs.available).toBe(INPUTS.available);
    expect(result.inputs.daysSincePto).toBe(INPUTS.daysSincePto);
    expect(result.inputs.onPto).toBe(INPUTS.onPto);
    expect(result.extras.weeklyCapacityHours).toBe(EXTRAS.weeklyCapacityHours);
    expect(result.extras.noBreakDayCount).toBe(EXTRAS.noBreakDayCount);
    expect(result.extras.weekendWorkDayCount).toBe(EXTRAS.weekendWorkDayCount);
    expect(result.extras.avgNetHours).toBe(EXTRAS.avgNetHours);
  });

  it("composes with computeBurnoutV2 to lower the projected score", () => {
    const baseline = computeBurnoutV2(INPUTS, EXTRAS);
    const { inputs, extras } = applyWhatIf(INPUTS, EXTRAS, {
      daysOff: 2,
      hoursMoved: 20,
      overdueResolved: 3,
      offHoursReduced: 6,
    });
    const projected = computeBurnoutV2(inputs, extras);
    expect(projected.compositeV2).toBeLessThan(baseline.compositeV2);
  });
});
