import type { IsoDate } from "@/lib/date";

/**
 * P8: meeting-load analysis. Pure and unit-tested; lib/supabase/meetings.ts
 * does the fetching.
 *
 * The point of this module is that a daily meeting *total* is close to
 * useless on its own. Four hours of meetings is a destroyed day or a
 * perfectly workable one depending entirely on whether it arrives as one
 * block or as eight scattered ones. Everything here is about shape, not
 * volume — which is why it needs calendar_events (0022) and could not have
 * been built from daily_activity.meeting_hours.
 */

/** Minutes of uninterrupted time that count as a real run at something.
 *  Below this you are context-switching, not working. */
export const DEEP_WORK_MINUTES = 90;

export interface MeetingBlock {
  /** Minutes from midnight, in the employee's own timezone. */
  startMin: number;
  endMin: number;
}

export interface FreeBlock {
  startMin: number;
  endMin: number;
  minutes: number;
}

/**
 * Gaps left in a working day once meetings are removed.
 *
 * Overlapping and touching meetings are merged first — two back-to-back
 * 30-minute calls are one 60-minute interruption, and double-booked slots
 * must not subtract twice or a busy day can report negative free time.
 */
export function freeBlocks(blocks: MeetingBlock[], dayStartMin: number, dayEndMin: number): FreeBlock[] {
  if (dayEndMin <= dayStartMin) return [];

  const clipped = blocks
    .map((b) => ({ startMin: Math.max(b.startMin, dayStartMin), endMin: Math.min(b.endMin, dayEndMin) }))
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const merged: MeetingBlock[] = [];
  for (const block of clipped) {
    const last = merged[merged.length - 1];
    if (last && block.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, block.endMin);
    } else {
      merged.push({ ...block });
    }
  }

  const gaps: FreeBlock[] = [];
  let cursor = dayStartMin;
  for (const block of merged) {
    if (block.startMin > cursor) {
      gaps.push({ startMin: cursor, endMin: block.startMin, minutes: block.startMin - cursor });
    }
    cursor = Math.max(cursor, block.endMin);
  }
  if (cursor < dayEndMin) {
    gaps.push({ startMin: cursor, endMin: dayEndMin, minutes: dayEndMin - cursor });
  }
  return gaps;
}

export function longestFreeBlock(blocks: MeetingBlock[], dayStartMin: number, dayEndMin: number): number {
  const gaps = freeBlocks(blocks, dayStartMin, dayEndMin);
  return gaps.reduce((max, g) => Math.max(max, g.minutes), 0);
}

export interface DayShape {
  date: IsoDate;
  meetingMinutes: number;
  meetingCount: number;
  longestFreeMinutes: number;
  hasDeepWorkBlock: boolean;
}

export function shapeOfDay(
  date: IsoDate,
  blocks: MeetingBlock[],
  dayStartMin: number,
  dayEndMin: number,
  deepWorkMinutes = DEEP_WORK_MINUTES
): DayShape {
  const longest = longestFreeBlock(blocks, dayStartMin, dayEndMin);
  // Meeting minutes must also be measured on the merged set, or a
  // double-booked hour would be counted twice.
  const gaps = freeBlocks(blocks, dayStartMin, dayEndMin);
  const freeTotal = gaps.reduce((s, g) => s + g.minutes, 0);
  return {
    date,
    meetingMinutes: Math.max(0, dayEndMin - dayStartMin - freeTotal),
    meetingCount: blocks.length,
    longestFreeMinutes: longest,
    hasDeepWorkBlock: longest >= deepWorkMinutes,
  };
}

export interface PersonMeetingLoad {
  employeeId: string;
  name: string;
  team: string;
  avatarColor: string;
  meetingHours: number;
  meetingCount: number;
  /** Working days in the window with no uninterrupted DEEP_WORK_MINUTES run. */
  daysWithoutDeepWork: number;
  workingDays: number;
  /** Share of working days that had at least one real block, 0-100. */
  deepWorkDayPct: number;
}

export function summarisePerson(
  person: { employeeId: string; name: string; team: string; avatarColor: string },
  days: DayShape[]
): PersonMeetingLoad {
  const workingDays = days.length;
  const withDeep = days.filter((d) => d.hasDeepWorkBlock).length;
  return {
    ...person,
    meetingHours: Math.round((days.reduce((s, d) => s + d.meetingMinutes, 0) / 60) * 10) / 10,
    meetingCount: days.reduce((s, d) => s + d.meetingCount, 0),
    daysWithoutDeepWork: workingDays - withDeep,
    workingDays,
    deepWorkDayPct: workingDays === 0 ? 0 : Math.round((withDeep / workingDays) * 100),
  };
}

export interface SeriesInput {
  seriesId: string;
  title: string;
  startMin: number;
  endMin: number;
  attendeeCount: number;
  /** One row per attendee per occurrence. */
  occurrences: number;
}

export interface SeriesAudit {
  seriesId: string;
  title: string;
  durationMinutes: number;
  attendeeCount: number;
  occurrences: number;
  /** The number that actually matters: duration x attendees x occurrences. */
  personHours: number;
  /** Recurring meetings that are both long and heavily attended are where
   *  the hours are; this is what to question first. */
  rank: number;
}

/**
 * Groups repeating meetings by series and ranks them by person-hours
 * consumed. A weekly 30-minute standup with 12 people costs more of the
 * organisation's time than a monthly 2-hour review with 3 — which is the
 * opposite of what a calendar looks like at a glance.
 */
export function auditSeries(series: SeriesInput[]): SeriesAudit[] {
  return series
    .map((s) => {
      const durationMinutes = Math.max(0, s.endMin - s.startMin);
      return {
        seriesId: s.seriesId,
        title: s.title,
        durationMinutes,
        attendeeCount: s.attendeeCount,
        occurrences: s.occurrences,
        personHours: Math.round(((durationMinutes * s.attendeeCount * s.occurrences) / 60) * 10) / 10,
        rank: 0,
      };
    })
    .sort((a, b) => b.personHours - a.personHours)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export interface NoMeetingDayOption {
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  label: string;
  meetingHours: number;
  affectedPeople: number;
  seriesToMove: number;
}

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};

/**
 * Which weekday would cost least to declare meeting-free, ranked cheapest
 * first. "No-meeting Wednesday" is a good policy badly chosen — the right
 * day is whichever one is already quietest, and that is an empirical
 * question per organisation.
 */
export function noMeetingDayOptions(
  rows: { weekday: number; meetingMinutes: number; employeeId: string; seriesId: string | null }[]
): NoMeetingDayOption[] {
  const byWeekday = new Map<number, { minutes: number; people: Set<string>; series: Set<string> }>();
  for (const row of rows) {
    if (row.weekday < 1 || row.weekday > 5) continue;
    const entry = byWeekday.get(row.weekday) ?? { minutes: 0, people: new Set(), series: new Set() };
    entry.minutes += row.meetingMinutes;
    entry.people.add(row.employeeId);
    if (row.seriesId) entry.series.add(row.seriesId);
    byWeekday.set(row.weekday, entry);
  }

  return [1, 2, 3, 4, 5]
    .map((weekday) => {
      const entry = byWeekday.get(weekday);
      return {
        weekday,
        label: WEEKDAY_LABEL[weekday],
        meetingHours: Math.round(((entry?.minutes ?? 0) / 60) * 10) / 10,
        affectedPeople: entry?.people.size ?? 0,
        seriesToMove: entry?.series.size ?? 0,
      };
    })
    .sort((a, b) => a.meetingHours - b.meetingHours || a.weekday - b.weekday);
}
