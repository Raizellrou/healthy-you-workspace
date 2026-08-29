/**
 * Timezone-aware date helpers.
 *
 * The app has no date library by design. Everything here is built on `Intl`,
 * which every runtime we target already ships.
 *
 * The bug this exists to kill: `new Date().toISOString().slice(0, 10)` returns
 * the UTC date, so a 9pm check-in in Asia/Manila (UTC+8) writes *tomorrow's*
 * date. Any column that means "the calendar day this happened for the person"
 * — `mood_checkins.date`, `work_sessions.work_date` — must go through
 * `todayInTz` instead.
 */

/** IANA zone used when an employee has no timezone set. */
export const DEFAULT_TIMEZONE = "Asia/Manila";

/** A `YYYY-MM-DD` calendar date. Not a timestamp — no time, no zone. */
export type IsoDate = string;

/** ISO weekday: 1 = Monday … 7 = Sunday. Matches Postgres `isodow`. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DATE_PARTS = new Map<string, Intl.DateTimeFormat>();
const CLOCK_PARTS = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = DATE_PARTS.get(timeZone);
  if (!fmt) {
    // "en-CA" formats as YYYY-MM-DD, so no part re-assembly is needed.
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DATE_PARTS.set(timeZone, fmt);
  }
  return fmt;
}

function clockFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = CLOCK_PARTS.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    CLOCK_PARTS.set(timeZone, fmt);
  }
  return fmt;
}

/** The calendar date at `instant`, as seen in `timeZone`. */
export function dateInTz(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE
): IsoDate {
  return dateFormatter(timeZone).format(instant);
}

/** Today's calendar date in `timeZone`. Use this instead of `toISOString().slice(0, 10)`. */
export function todayInTz(timeZone: string = DEFAULT_TIMEZONE): IsoDate {
  return dateInTz(new Date(), timeZone);
}

/** Minutes since local midnight at `instant`, as seen in `timeZone`. 0–1439. */
export function minutesSinceMidnightInTz(
  instant: Date,
  timeZone: string = DEFAULT_TIMEZONE
): number {
  const [hh, mm] = clockFormatter(timeZone).format(instant).split(":");
  return Number(hh) * 60 + Number(mm);
}

/**
 * ISO weekday (1 = Mon … 7 = Sun) of a `YYYY-MM-DD` date.
 *
 * Parsed as UTC noon so a DST shift in either direction can't tip it into an
 * adjacent day. A bare date string has no zone, so this is a pure calendar
 * calculation — it does not depend on where the reader is.
 */
export function isoWeekday(date: IsoDate): IsoWeekday {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** True for Saturday and Sunday. */
export function isWeekend(date: IsoDate): boolean {
  return isoWeekday(date) >= 6;
}

/** `date` shifted by `days` (negative goes backwards). Calendar math, not elapsed time. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Minutes `timeZone` is ahead of UTC on `date` (negative when behind).
 *
 * The inverse of the rest of this module: everything else converts an
 * instant into local terms, this converts local terms back into an instant.
 * Needed wherever a wall-clock time in someone's own day has to be stored
 * in a `timestamptz` — writing `${date}T09:00:00Z` to mean "9am local" is
 * off by the whole offset, which in Asia/Manila lands the event at 5pm.
 */
export function tzOffsetMinutes(date: IsoDate, timeZone: string = DEFAULT_TIMEZONE): number {
  const instant = new Date(`${date}T12:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

/** The instant at which local wall-clock `minutes` occurs on `date` in `timeZone`. */
export function instantFromLocal(date: IsoDate, minutes: number, timeZone: string = DEFAULT_TIMEZONE): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) + (minutes - tzOffsetMinutes(date, timeZone)) * 60_000);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Every date from `start` to `end` inclusive, ascending. */
export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  const span = daysBetween(start, end);
  for (let i = 0; i <= span; i++) out.push(addDays(start, i));
  return out;
}

/** True when `date` falls inside `[start, end]` inclusive. */
export function isWithin(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

/** `540` → `"09:00"`. For rendering schedule minutes. */
export function fmtMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** `"2026-08-18"` → `"Tue 18 Aug"`. Timezone-free: the string is already a calendar date. */
export function fmtDate(date: IsoDate): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Elapsed milliseconds rendered as `"3h 40m"` / `"12m"`. */
export function fmtDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Elapsed milliseconds rendered as a zero-padded stopwatch readout,
 *  `"01:04:09"` — for a live-ticking display, unlike fmtDuration's
 *  minute-granularity summary. */
export function fmtClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
