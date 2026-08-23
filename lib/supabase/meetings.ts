import { createClient } from "@/lib/supabase/server";
import { getVisibleEmployees } from "@/lib/supabase/people";
import { getSchedulableReports } from "@/lib/supabase/one-on-ones";
import {
  shapeOfDay,
  summarisePerson,
  auditSeries,
  noMeetingDayOptions,
  DEEP_WORK_MINUTES,
  type MeetingBlock,
  type PersonMeetingLoad,
  type SeriesAudit,
  type NoMeetingDayOption,
} from "@/lib/meetings";
import { addDays, dateInTz, minutesSinceMidnightInTz, isoWeekday, todayInTz, type IsoDate } from "@/lib/date";
import type { Person } from "@/types/person";

/**
 * Fetch layer for the meeting-load screen. All analysis lives in
 * lib/meetings.ts.
 *
 * Every timestamp is converted into the *employee's own* local minutes
 * before any gap maths happens. A meeting at 09:00 is a morning meeting for
 * the person in it regardless of where the viewer is sitting, and comparing
 * a Manila calendar against a viewer's clock would silently shift every
 * block — which for a "was there a 90-minute gap" question is the whole
 * answer.
 */

const WINDOW_DAYS = 28;

export interface MeetingInsights {
  windowDays: number;
  people: PersonMeetingLoad[];
  series: SeriesAudit[];
  noMeetingDays: NoMeetingDayOption[];
  totalMeetingHours: number;
  /** Working days across the whole scope that contained no uninterrupted
   *  deep-work block. A count of *days lost* rather than of people who
   *  never once got a block — the latter reads as 0 in any org where
   *  everyone has at least one good day, while sitting directly above a
   *  list of people losing most of their week. */
  daysWithoutDeepWork: number;
  peopleAffected: number;
  deepWorkMinutes: number;
}

interface EventRow {
  id: string;
  employee_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  series_id: string | null;
  attendee_count: number;
}

export async function getMeetingInsights(me: Person): Promise<MeetingInsights> {
  const supabase = await createClient();

  // Managers analyse their reports; HR the whole org. Same set the 1:1
  // surface offers, so the two screens can never disagree about scope.
  const roster = me.appRole === "hr" ? await getVisibleEmployees() : await getSchedulableReports(me);
  if (roster.length === 0) {
    return {
      windowDays: WINDOW_DAYS,
      people: [],
      series: [],
      noMeetingDays: noMeetingDayOptions([]),
      totalMeetingHours: 0,
      daysWithoutDeepWork: 0,
      peopleAffected: 0,
      deepWorkMinutes: DEEP_WORK_MINUTES,
    };
  }

  const today = todayInTz(me.timezone);
  const windowStart = addDays(today, -WINDOW_DAYS);
  const rosterIds = roster.map((p) => p.id);

  // PostgREST caps a single response at 1000 rows, and a month of meetings
  // across a 24-person org comfortably exceeds that — an unpaged read here
  // silently truncated the calendar and under-reported every total. Page
  // explicitly rather than trusting a default limit.
  const events: EventRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id, employee_id, title, starts_at, ends_at, series_id, attendee_count")
      .in("employee_id", rosterIds)
      .gte("starts_at", `${windowStart}T00:00:00Z`)
      .order("starts_at", { ascending: true })
      .range(offset, offset + PAGE - 1)
      .returns<EventRow[]>();
    if (error) {
      throw new Error(`Failed to load calendar events: ${error.message}`);
    }
    events.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const schedulesRes = await supabase
    .from("work_schedules")
    .select("employee_id, start_min, end_min")
    .in("employee_id", rosterIds)
    .returns<{ employee_id: string; start_min: number; end_min: number }[]>();
  const scheduleBy = new Map((schedulesRes.data ?? []).map((s) => [s.employee_id, s]));

  // Bucket every event into (employee, local date) with local minute bounds.
  const byEmployeeDay = new Map<string, Map<IsoDate, MeetingBlock[]>>();
  const seriesByEmployeeDay = new Map<string, Set<string>>();
  const seriesAccumulator = new Map<
    string,
    { title: string; startMin: number; endMin: number; attendeeCount: number; occurrences: Set<string> }
  >();

  for (const event of events) {
    const person = roster.find((p) => p.id === event.employee_id);
    if (!person) continue;
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    const localDate = dateInTz(start, person.timezone);
    const startMin = minutesSinceMidnightInTz(start, person.timezone);
    // An event ending past local midnight would wrap to a small number;
    // clamp to end-of-day rather than producing a negative-length block.
    const rawEndMin = minutesSinceMidnightInTz(end, person.timezone);
    const endMin = rawEndMin > startMin ? rawEndMin : 1440;

    const days = byEmployeeDay.get(event.employee_id) ?? new Map<IsoDate, MeetingBlock[]>();
    const blocks = days.get(localDate) ?? [];
    blocks.push({ startMin, endMin });
    days.set(localDate, blocks);
    byEmployeeDay.set(event.employee_id, days);

    if (event.series_id) {
      const key = `${event.employee_id}|${localDate}`;
      const set = seriesByEmployeeDay.get(key) ?? new Set<string>();
      set.add(event.series_id);
      seriesByEmployeeDay.set(key, set);
    }

    if (event.series_id) {
      const entry = seriesAccumulator.get(event.series_id) ?? {
        title: event.title,
        startMin,
        endMin,
        attendeeCount: event.attendee_count,
        occurrences: new Set<string>(),
      };
      entry.occurrences.add(localDate);
      entry.attendeeCount = Math.max(entry.attendeeCount, event.attendee_count);
      seriesAccumulator.set(event.series_id, entry);
    }
  }

  // Derived from the same merged, working-hours-clipped day shapes the
  // per-person summaries use. Building this from raw event durations
  // instead produced a screen that contradicted itself — a single weekday
  // reporting more hours than the org-wide total, because raw durations
  // double-count overlaps and include time outside anyone's working day.
  const weekdayRows: { weekday: number; meetingMinutes: number; employeeId: string; seriesId: string | null }[] = [];

  const summaries = roster.map((person) => {
    const schedule = scheduleBy.get(person.id);
    const dayStart = schedule?.start_min ?? 540;
    const dayEnd = schedule?.end_min ?? 1080;
    const days = byEmployeeDay.get(person.id) ?? new Map<IsoDate, MeetingBlock[]>();

    // Only weekdays that actually carry meetings are counted as working
    // days here. Including every calendar weekday would dilute the
    // "days without a deep-work block" figure with days this person may
    // not have worked at all — attendance owns that question, not this screen.
    const shapes = [...days.entries()]
      .filter(([date]) => isoWeekday(date) <= 5)
      .map(([date, blocks]) => shapeOfDay(date, blocks, dayStart, dayEnd));

    for (const shape of shapes) {
      const seriesOnDay = seriesByEmployeeDay.get(`${person.id}|${shape.date}`);
      weekdayRows.push({
        weekday: isoWeekday(shape.date),
        meetingMinutes: shape.meetingMinutes,
        employeeId: person.id,
        seriesId: seriesOnDay && seriesOnDay.size > 0 ? [...seriesOnDay][0] : null,
      });
    }

    return summarisePerson(
      { employeeId: person.id, name: person.name, team: person.team, avatarColor: person.avatarColor },
      shapes
    );
  });

  const series = auditSeries(
    [...seriesAccumulator.entries()].map(([seriesId, entry]) => ({
      seriesId,
      title: entry.title,
      startMin: entry.startMin,
      endMin: entry.endMin,
      attendeeCount: entry.attendeeCount,
      occurrences: entry.occurrences.size,
    }))
  );

  const affected = summaries.filter((s) => s.workingDays > 0 && s.daysWithoutDeepWork > 0);

  return {
    windowDays: WINDOW_DAYS,
    people: summaries.sort((a, b) => b.daysWithoutDeepWork - a.daysWithoutDeepWork || b.meetingHours - a.meetingHours),
    series,
    noMeetingDays: noMeetingDayOptions(weekdayRows),
    totalMeetingHours: Math.round(summaries.reduce((s, p) => s + p.meetingHours, 0) * 10) / 10,
    daysWithoutDeepWork: summaries.reduce((s, p) => s + p.daysWithoutDeepWork, 0),
    peopleAffected: affected.length,
    deepWorkMinutes: DEEP_WORK_MINUTES,
  };
}
