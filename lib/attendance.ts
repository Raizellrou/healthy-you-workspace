import { addDays, isWeekend, minutesSinceMidnightInTz, type IsoDate } from "@/lib/date";
import { WORK_END_MIN } from "@/lib/constants";

/**
 * Pure attendance math (P4 — real clock in/out). Every function here takes
 * plain rows, not a Supabase client, so it's unit-testable without a
 * database — see lib/__tests__/attendance.test.ts. lib/supabase/attendance.ts
 * is the thin fetch layer that hands these functions real rows.
 */

export interface WorkSessionRow {
  id: string;
  employee_id: string;
  clock_in: string; // ISO instant
  clock_out: string | null;
  work_date: IsoDate;
}

export interface SessionBreakRow {
  id: string;
  session_id: string;
  break_start: string; // ISO instant
  break_end: string | null;
}

/** Net minutes worked in one session: gross clocked time minus every break
 *  inside it. An open session/break counts up to `now`, so a live widget can
 *  show a running total — but every value that gets PERSISTED comes from a
 *  server action's own `now()`, never from this client-side clock. */
export function netMinutes(session: WorkSessionRow, breaks: SessionBreakRow[], now: Date = new Date()): number {
  const start = new Date(session.clock_in).getTime();
  const end = (session.clock_out ? new Date(session.clock_out) : now).getTime();
  const gross = Math.max(0, end - start);

  const breakMs = breaks
    .filter((b) => b.session_id === session.id)
    .reduce((sum, b) => {
      const bStart = new Date(b.break_start).getTime();
      const bEnd = (b.break_end ? new Date(b.break_end) : now).getTime();
      return sum + Math.max(0, bEnd - bStart);
    }, 0);

  return Math.max(0, (gross - breakMs) / 60_000);
}

export interface DayRollup {
  workDate: IsoDate;
  netHours: number;
  grossHours: number;
  breakHours: number;
  firstIn: string | null;
  lastOut: string | null;
  sessionCount: number;
  openSession: boolean;
}

/** Groups sessions by work_date and reduces each day to one summary row.
 *  Multiple sessions on the same work_date (clock out for lunch, back in
 *  the afternoon, recorded as two rows rather than a mid-session break) sum
 *  together correctly. */
export function rollupDays(
  sessions: WorkSessionRow[],
  breaks: SessionBreakRow[],
  now: Date = new Date()
): DayRollup[] {
  const byDate = new Map<string, WorkSessionRow[]>();
  for (const s of sessions) {
    const list = byDate.get(s.work_date) ?? [];
    list.push(s);
    byDate.set(s.work_date, list);
  }

  const out: DayRollup[] = [];
  for (const [workDate, daySessions] of byDate) {
    let netMs = 0;
    let grossMs = 0;
    let firstIn: string | null = null;
    let lastOut: string | null = null;
    let openSession = false;

    for (const s of daySessions) {
      const end = s.clock_out ? new Date(s.clock_out) : now;
      grossMs += Math.max(0, end.getTime() - new Date(s.clock_in).getTime());
      netMs += netMinutes(s, breaks, now) * 60_000;
      if (!firstIn || s.clock_in < firstIn) firstIn = s.clock_in;
      if (s.clock_out && (!lastOut || s.clock_out > lastOut)) lastOut = s.clock_out;
      if (!s.clock_out) openSession = true;
    }

    out.push({
      workDate,
      netHours: Math.round((netMs / 3_600_000) * 100) / 100,
      grossHours: Math.round((grossMs / 3_600_000) * 100) / 100,
      breakHours: Math.round(((grossMs - netMs) / 3_600_000) * 100) / 100,
      firstIn,
      lastOut,
      sessionCount: daySessions.length,
      openSession,
    });
  }

  return out.sort((a, b) => a.workDate.localeCompare(b.workDate));
}

/**
 * Consecutive trailing workdays with clocked hours, walking back from
 * `today`. Weekends are skipped without breaking the streak; a weekday with
 * no clocked hours, or one covered by an approved PTO date, ends it.
 *
 * If `today` itself has no session yet (hasn't clocked in this morning),
 * the streak reads as 0 until they do — an honest reflection of real data,
 * not a bug: the old `daily_activity`-based streak had the same "today
 * counts only once it's logged" property.
 */
export function consecutiveWorkDays(
  rollups: Pick<DayRollup, "workDate" | "netHours">[],
  ptoDates: Set<IsoDate>,
  today: IsoDate
): number {
  const hoursByDate = new Map(rollups.map((r) => [r.workDate, r.netHours]));
  let streak = 0;
  let cursor = today;

  for (let i = 0; i < 60; i++) {
    if (isWeekend(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (ptoDates.has(cursor)) break;
    const hours = hoursByDate.get(cursor) ?? 0;
    if (hours <= 0) break;
    streak++;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Average net hours across the given rollup rows — pass the trailing
 *  window you want (e.g. the last 14 workdays with a session) already
 *  sliced; this doesn't fill in missing/zero days itself. */
export function avgNetHours(rollups: Pick<DayRollup, "netHours">[]): number {
  if (rollups.length === 0) return 0;
  const total = rollups.reduce((sum, r) => sum + r.netHours, 0);
  return Math.round((total / rollups.length) * 100) / 100;
}

/** Days where the last clock-out fell at or after the standard work-window
 *  end, in the person's own timezone. */
export function lateClockOuts(rollups: Pick<DayRollup, "lastOut">[], timezone: string): number {
  return rollups.filter(
    (r) => r.lastOut && minutesSinceMidnightInTz(new Date(r.lastOut), timezone) >= WORK_END_MIN
  ).length;
}

/** Days actually worked on a Saturday or Sunday. */
export function weekendWorkDays(rollups: Pick<DayRollup, "workDate" | "netHours">[]): number {
  return rollups.filter((r) => isWeekend(r.workDate) && r.netHours > 0).length;
}

/** Long days (>= `minNetHours`) with zero recorded break time — the signal
 *  a "3h 40m in, no break yet" nudge would key off. */
export function noBreakDays(rollups: Pick<DayRollup, "netHours" | "breakHours">[], minNetHours = 5): number {
  return rollups.filter((r) => r.netHours >= minNetHours && r.breakHours <= 0).length;
}

/** True when `date` falls within [start, end] of any row in `pto` — used to
 *  build the ptoDates set consecutiveWorkDays needs from raw pto_requests. */
export function isPtoDate(date: IsoDate, pto: { start_date: IsoDate; end_date: IsoDate; status: string }[]): boolean {
  return pto.some((p) => p.status === "approved" && date >= p.start_date && date <= p.end_date);
}

/** `pto_requests` rows expanded into the individual dates they cover, for
 *  building the ptoDates set consecutiveWorkDays takes directly. */
export function expandPtoDates(pto: { start_date: IsoDate; end_date: IsoDate; status: string }[]): Set<IsoDate> {
  const dates = new Set<IsoDate>();
  for (const p of pto) {
    if (p.status !== "approved") continue;
    let cursor = p.start_date;
    while (cursor <= p.end_date) {
      dates.add(cursor);
      cursor = addDays(cursor, 1);
    }
  }
  return dates;
}

/** Days since the most recent approved PTO day at or before `today`, or
 *  `windowDays` (the caller's lookback horizon) if none appears in it. */
export function daysSincePto(pto: { start_date: IsoDate; end_date: IsoDate; status: string }[], today: IsoDate, windowDays = 90): number {
  const approvedEnds = pto.filter((p) => p.status === "approved" && p.end_date <= today).map((p) => p.end_date);
  if (approvedEnds.length === 0) return windowDays;
  const mostRecent = approvedEnds.sort().at(-1)!;
  return Math.max(0, dayDiff(mostRecent, today));
}

function dayDiff(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** True when `today` falls inside an approved PTO range. */
export function isOnPtoToday(pto: { start_date: IsoDate; end_date: IsoDate; status: string }[], today: IsoDate): boolean {
  return isPtoDate(today, pto);
}

// Re-exported so lib/date.ts stays the single home for the type, while
// call sites that only need attendance math can import from here.
export type { IsoDate };
