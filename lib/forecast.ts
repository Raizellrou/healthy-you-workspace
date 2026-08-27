import { computeBurnoutV2, type BurnoutV2Extras } from "@/lib/burnout-signals";
import type { BurnoutInputs } from "@/lib/burnout";
import type { BurnoutBand } from "@/types/burnout";

/**
 * Burnout forecast (P9). There is no compositeV2 history to extrapolate —
 * getBurnoutHistory (lib/supabase/queries.ts) re-derives only the *base*
 * composite from daily_activity, and that's a trailing series anyway, not
 * a model. So this isn't a curve fit: it recomputes compositeV2 once per
 * upcoming day, holding today's real committedHours/recovery signals
 * fixed and only shifting the three things that actually have a forward
 * signal — scheduled meeting hours, tasks about to come due, and booked
 * PTO — through the exact same computeBurnoutV2 the rest of the app uses.
 * "Projection of known scheduled load", not a prediction.
 */

export type ForecastConfidence = "high" | "medium";

export interface ForecastPoint {
  /** 1 = tomorrow … 7 = a week out. */
  dayOffset: number;
  compositeV2: number;
  bandV2: BurnoutBand;
  confidence: ForecastConfidence;
}

export function forecastNext7Days({
  inputs,
  extras,
  upcomingMeetingHours,
  upcomingDueTasks,
  ptoScheduled,
  weeklyCapacityHours,
}: {
  inputs: BurnoutInputs;
  extras: BurnoutV2Extras;
  /** Meeting hours scheduled on each of the next 7 days, tomorrow first —
   *  substituted directly for meetingAvg on that day: the forecast asks
   *  "what would the score be if this scheduled day were representative",
   *  not "what is the person's rolling average that day". */
  upcomingMeetingHours: number[];
  /** Count of this person's open tasks due on each of the next 7 days. */
  upcomingDueTasks: number[];
  /** Whether approved PTO covers each of the next 7 days. */
  ptoScheduled: boolean[];
  weeklyCapacityHours: number;
}): ForecastPoint[] {
  const days = Math.min(7, upcomingMeetingHours.length, upcomingDueTasks.length, ptoScheduled.length);
  const points: ForecastPoint[] = [];

  let runningOverdue = extras.overdueTaskCount;
  let runningDaysSincePto = inputs.daysSincePto;

  for (let i = 0; i < days; i++) {
    const onPtoThisDay = ptoScheduled[i];
    runningDaysSincePto = onPtoThisDay ? 0 : runningDaysSincePto + 1;
    // A task due ON day i isn't overdue yet on day i — it becomes overdue
    // starting the day after, so day i's running total only picks up
    // whatever came due the day before it (day 0 / "today" is already
    // baked into extras.overdueTaskCount, so there's nothing to add before
    // the loop's first iteration).
    if (i > 0) runningOverdue += upcomingDueTasks[i - 1];

    const dayInputs: BurnoutInputs = {
      ...inputs,
      meetingAvg: upcomingMeetingHours[i],
      daysSincePto: runningDaysSincePto,
      // onPto deliberately left as-is (today's real value), not toggled by
      // ptoScheduled: the base scorer treats onPto+offHoursWeekly>0 as
      // "still working during approved time off" — a real today-only
      // signal this forecast has no forward-looking basis for. Only the
      // days-since-PTO counter, which ptoScheduled genuinely does inform,
      // shifts.
    };
    const dayExtras: BurnoutV2Extras = {
      ...extras,
      overdueTaskCount: runningOverdue,
      weeklyCapacityHours,
    };
    const scores = computeBurnoutV2(dayInputs, dayExtras);
    points.push({
      dayOffset: i + 1,
      compositeV2: Math.round(scores.compositeV2),
      bandV2: scores.bandV2,
      // Real calendar/task data thins out the further ahead you look in
      // this fixture data — not a statistical claim, just an honest label
      // matching the "About this data" caveat pattern /meetings already uses.
      confidence: i < 3 ? "high" : "medium",
    });
  }
  return points;
}
