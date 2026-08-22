import { computeBurnout, bandFor, dominantDriver, type BurnoutInputs } from "@/lib/burnout";
import { capacityLoad } from "@/lib/tasks";
import type { BurnoutBand, BurnoutScores } from "@/types/burnout";

/**
 * Burnout v2: real attendance/task data feeding the frozen `computeBurnout`
 * (Layer 1) and extending it with three task-engine factors (Layer 2),
 * without editing lib/burnout.ts. Both layers documented in the P4 plan:
 *
 * Layer 1 — same scoring function, honest inputs. `toBurnoutInputs` produces
 * the exact frozen `BurnoutInputs` shape from real work_sessions/pto_requests
 * data instead of the synthetic `daily_activity` booleans.
 *
 * Layer 2 — `computeBurnoutV2` composes `computeBurnout` + `bandFor` (both
 * exported by the frozen module) with taskLoad/overdue/recovery, so the base
 * weights stay untouched and the UI can show "base 61 -> task-aware 74" side
 * by side.
 */

/**
 * Builds the frozen module's input shape from real signals:
 *  - `streakDays`/`daysSincePto`/`onPto` from real work_sessions + pto_requests
 *    (via lib/attendance.ts), not the daily_activity booleans
 *  - `available` becomes average net clocked hours once there's a
 *    meaningful amount of it (>= 1h); falls back to the daily_activity-
 *    derived value (`fallbackAvailable`) otherwise. The threshold matters:
 *    someone who clocked in thirty seconds ago has an avgNetHours near
 *    zero, and `meetingAvg / available` with available≈0 blows the meeting
 *    factor up to 100 — a real bug caught live (Beatriz Haddad's very
 *    first clock-in spiked her meeting-load factor to 100 before this
 *    guard existed). "Any nonzero value" isn't a proxy for "enough real
 *    session history to trust" — 1 hour is.
 *  - `meetingAvg` is untouched — meetings aren't tracked by work_sessions,
 *    daily_activity.meeting_hours remains the source until a P6 calendar
 */
export function toBurnoutInputs(params: {
  meetingAvg: number;
  fallbackAvailable: number;
  streakDays: number;
  avgNetHours: number;
  offHoursWeekly: number;
  daysSincePto: number;
  onPto: boolean;
}): BurnoutInputs {
  return {
    streakDays: params.streakDays,
    meetingAvg: params.meetingAvg,
    available: params.avgNetHours >= 1 ? params.avgNetHours : params.fallbackAvailable,
    offHoursWeekly: params.offHoursWeekly,
    daysSincePto: params.daysSincePto,
    onPto: params.onPto,
  };
}

export interface BurnoutV2Extras {
  /** Sum of estimateOrDefault() over this person's open tasks due within 7 days. */
  committedHours: number;
  weeklyCapacityHours: number;
  overdueTaskCount: number;
  noBreakDayCount: number;
  weekendWorkDayCount: number;
  avgNetHours: number;
}

export interface BurnoutV2Factors {
  taskLoad: number;
  overdue: number;
  recovery: number;
}

export function computeV2Factors(extras: BurnoutV2Extras): BurnoutV2Factors {
  const taskLoad = Math.min(100, capacityLoad(extras.committedHours, extras.weeklyCapacityHours));
  const overdue = Math.min(100, extras.overdueTaskCount * 20);
  const recovery = Math.min(
    100,
    extras.noBreakDayCount * 15 + extras.weekendWorkDayCount * 20 + (extras.avgNetHours > 9.5 ? 25 : 0)
  );
  return { taskLoad, overdue, recovery };
}

export interface BurnoutV2Scores extends BurnoutScores {
  compositeV2: number;
  bandV2: BurnoutBand;
  taskLoad: number;
  overdue: number;
  recovery: number;
}

/** compositeV2 = 70% base composite + 12% taskLoad + 10% overdue + 8% recovery.
 *  Base weights inside computeBurnout are untouched; this only adds on top. */
export function computeBurnoutV2(inputs: BurnoutInputs, extras: BurnoutV2Extras): BurnoutV2Scores {
  const base = computeBurnout(inputs);
  const { taskLoad, overdue, recovery } = computeV2Factors(extras);
  const compositeV2 = 0.7 * base.composite + 0.12 * taskLoad + 0.1 * overdue + 0.08 * recovery;
  return { ...base, compositeV2, bandV2: bandFor(compositeV2), taskLoad, overdue, recovery };
}

type V2FactorKey = "taskLoad" | "overdue" | "recovery";
const V2_FACTOR_LABEL: Record<V2FactorKey, string> = {
  taskLoad: "a heavy committed task load relative to capacity",
  overdue: "a build-up of overdue tasks",
  recovery: "too little recovery time between long days",
};

/** Delegates to the frozen `dominantDriver` when a base (streak/meeting/
 *  offHours/pto) factor is highest; only names a v2 factor when one of
 *  those actually out-scores every base factor. */
export function dominantDriverV2(scores: BurnoutV2Scores): { key: string; label: string } {
  const base = dominantDriver(scores);
  const candidates: { key: string; label: string; value: number }[] = [
    { key: base.key, label: base.label, value: scores[base.key] },
    { key: "taskLoad", label: V2_FACTOR_LABEL.taskLoad, value: scores.taskLoad },
    { key: "overdue", label: V2_FACTOR_LABEL.overdue, value: scores.overdue },
    { key: "recovery", label: V2_FACTOR_LABEL.recovery, value: scores.recovery },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return { key: candidates[0].key, label: candidates[0].label };
}
