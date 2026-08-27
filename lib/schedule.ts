import {
  addDays,
  daysBetween,
  dateInTz,
  minutesSinceMidnightInTz,
  isoWeekday,
  DEFAULT_TIMEZONE,
  type IsoDate,
  type IsoWeekday,
} from "@/lib/date";
import { WORK_START_MIN, WORK_END_MIN } from "@/lib/constants";

/**
 * Per-employee work schedules — the generalization of the frozen
 * lib/boundary.ts's abstract 0=Mon..6=Sun index + global WORK_START_MIN/
 * WORK_END_MIN into real per-person schedules with real Dates. This module
 * supersedes lib/boundary.ts; that file stays on disk untouched (frozen,
 * still exported and used by app/(app)/boundary/*) until a later phase
 * migrates its one caller over.
 *
 * No timezone field here — work_schedules (0014) doesn't duplicate
 * employees.timezone (P2). Every function below takes the timezone as a
 * parameter, sourced from the employee row at the call site, so there's
 * exactly one place that can go stale.
 */

export interface WorkSchedule {
  timezone: string;
  /** ISO weekdays worked: 1=Mon .. 7=Sun. */
  workdays: IsoWeekday[];
  startMin: number;
  endMin: number;
  /** Do-not-disturb window. May wrap past midnight (quietStartMin > quietEndMin, e.g. 20:00-08:00). */
  quietStartMin: number;
  quietEndMin: number;
}

export const DEFAULT_QUIET_START_MIN = 20 * 60; // 8pm
export const DEFAULT_QUIET_END_MIN = 8 * 60; // 8am

export const DEFAULT_SCHEDULE: WorkSchedule = {
  timezone: DEFAULT_TIMEZONE,
  workdays: [1, 2, 3, 4, 5],
  startMin: WORK_START_MIN,
  endMin: WORK_END_MIN,
  quietStartMin: DEFAULT_QUIET_START_MIN,
  quietEndMin: DEFAULT_QUIET_END_MIN,
};

export function isWorkday(schedule: WorkSchedule, weekday: IsoWeekday): boolean {
  return schedule.workdays.includes(weekday);
}

export function isWithinWorkingHours(schedule: WorkSchedule, instant: Date): boolean {
  const date = dateInTz(instant, schedule.timezone);
  if (!isWorkday(schedule, isoWeekday(date))) return false;
  const minutes = minutesSinceMidnightInTz(instant, schedule.timezone);
  return minutes >= schedule.startMin && minutes < schedule.endMin;
}

/** Handles a window that wraps midnight (quietStartMin > quietEndMin) as
 *  well as one that doesn't, without the caller needing to know which. */
export function isQuietHours(schedule: WorkSchedule, instant: Date): boolean {
  const minutes = minutesSinceMidnightInTz(instant, schedule.timezone);
  if (schedule.quietStartMin <= schedule.quietEndMin) {
    return minutes >= schedule.quietStartMin && minutes < schedule.quietEndMin;
  }
  return minutes >= schedule.quietStartMin || minutes < schedule.quietEndMin;
}

/** The real UTC instant corresponding to `minutes`-since-midnight on
 *  `date`, as observed in `timezone`. Converges in one pass except across
 *  a DST transition landing on the exact target minute, which this app's
 *  data never hits — the second pass is defensive, not load-bearing. */
function instantAt(date: IsoDate, minutes: number, timezone: string): Date {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  let guess = new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`);

  for (let i = 0; i < 2; i++) {
    const actualDate = dateInTz(guess, timezone);
    const actualMinutes = minutesSinceMidnightInTz(guess, timezone);
    const diffMinutes = daysBetween(actualDate, date) * 1440 + (minutes - actualMinutes);
    if (diffMinutes === 0) break;
    guess = new Date(guess.getTime() + diffMinutes * 60_000);
  }
  return guess;
}

/**
 * The next real Date at/after `instant` that falls inside `schedule`'s
 * working hours — a genuine calendar timestamp, not lib/boundary.ts's
 * abstract weekday index. Bounded to 14 days out so a misconfigured
 * schedule (empty `workdays`) can't loop forever.
 */
export function nextWorkStart(schedule: WorkSchedule, instant: Date): Date {
  let cursor = dateInTz(instant, schedule.timezone);
  const instantMinutes = minutesSinceMidnightInTz(instant, schedule.timezone);

  for (let i = 0; i < 14; i++) {
    const weekday = isoWeekday(cursor);
    const sameDayStillAhead = i === 0 && instantMinutes < schedule.startMin;
    if (isWorkday(schedule, weekday) && (i > 0 || sameDayStillAhead)) {
      return instantAt(cursor, schedule.startMin, schedule.timezone);
    }
    cursor = addDays(cursor, 1);
  }
  // Unreachable with any schedule that works at least one day a week.
  return instantAt(cursor, schedule.startMin, schedule.timezone);
}

function nextHourBoundary(instant: Date): Date {
  const next = new Date(instant);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export type BatchingMode = "immediate" | "hourly" | "daily_digest";
export type HeldReason = "quiet_hours" | "batched" | null;

export interface DeliverResolution {
  deliverAfter: Date;
  heldReason: HeldReason;
}

/**
 * The one policy function every notification passes through
 * (lib/notify.ts#enqueue). Quiet hours / non-working-hours always win —
 * Right to Disconnect's guarantee shouldn't depend on someone's batching
 * preference. Only once a notification would land inside working hours
 * does batching_mode get a say.
 */
export function resolveDeliverAfter(
  schedule: WorkSchedule,
  batchingMode: BatchingMode,
  instant: Date
): DeliverResolution {
  if (isQuietHours(schedule, instant) || !isWithinWorkingHours(schedule, instant)) {
    return { deliverAfter: nextWorkStart(schedule, instant), heldReason: "quiet_hours" };
  }
  if (batchingMode === "hourly") {
    return { deliverAfter: nextHourBoundary(instant), heldReason: "batched" };
  }
  if (batchingMode === "daily_digest") {
    return { deliverAfter: nextWorkStart(schedule, instant), heldReason: "batched" };
  }
  return { deliverAfter: instant, heldReason: null };
}
