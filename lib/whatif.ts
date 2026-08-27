import type { BurnoutInputs } from "@/lib/burnout";
import type { BurnoutV2Extras } from "@/lib/burnout-signals";

/**
 * P8: the burnout what-if simulator. Not a new scoring model — sliders over
 * the exact same `BurnoutInputs`/`BurnoutV2Extras` that already feed the
 * frozen `computeBurnout` and `computeBurnoutV2` (lib/burnout.ts,
 * lib/burnout-signals.ts), perturbed by a hypothetical intervention and fed
 * back through those same pure functions. "If Rita takes 2 days off and 8
 * hours of tasks move" is just `applyWhatIf` plus the score functions this
 * codebase already has and already tests.
 */

export interface WhatIfAdjustments {
  /** Consecutive work days taken off — subtracted from streakDays, since
   *  that's exactly what breaks the streak (lib/attendance.ts#consecutiveWorkDays). */
  daysOff: number;
  /** Hours of committed task load handed to a teammate — same lever as the
   *  P8 workload rebalancer, just previewed instead of applied. */
  hoursMoved: number;
  /** Overdue tasks closed out or reassigned. */
  overdueResolved: number;
  /** Off-hours messages/activity eliminated (e.g. by enforcing quiet hours). */
  offHoursReduced: number;
}

export const EMPTY_ADJUSTMENTS: WhatIfAdjustments = {
  daysOff: 0,
  hoursMoved: 0,
  overdueResolved: 0,
  offHoursReduced: 0,
};

/** Every field floors at 0 — an adjustment can only move a lever toward
 *  zero load, never past it into a meaningless negative. */
export function applyWhatIf(
  inputs: BurnoutInputs,
  extras: BurnoutV2Extras,
  adjustments: WhatIfAdjustments
): { inputs: BurnoutInputs; extras: BurnoutV2Extras } {
  return {
    inputs: {
      ...inputs,
      streakDays: Math.max(0, inputs.streakDays - adjustments.daysOff),
      offHoursWeekly: Math.max(0, inputs.offHoursWeekly - adjustments.offHoursReduced),
    },
    extras: {
      ...extras,
      committedHours: Math.max(0, extras.committedHours - adjustments.hoursMoved),
      overdueTaskCount: Math.max(0, extras.overdueTaskCount - adjustments.overdueResolved),
    },
  };
}
