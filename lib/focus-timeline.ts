import { minutesSinceMidnightInTz } from "@/lib/date";

/**
 * The real replacement for lib/constants.ts's fake FOCUS_TIMELINE — built
 * from actual work_sessions/session_breaks instants instead of six
 * hardcoded blocks. No calendar_events table exists (still no reader, same
 * "no dead schema" call made every prior phase), so this doesn't attempt
 * meeting blocks — only what's genuinely known: when the person was
 * clocked in, when they were on a break, and what's neither.
 */
export type FocusBlockKind = "worked" | "break" | "gap";

export interface FocusBlock {
  startMin: number;
  endMin: number;
  kind: FocusBlockKind;
}

export interface TimelineSession {
  clockIn: string; // ISO instant
  clockOut: string | null;
}

export interface TimelineBreak {
  breakStart: string; // ISO instant
  breakEnd: string | null;
}

/**
 * Builds a minute-resolution timeline over `[windowStartMin, windowEndMin)`
 * for one calendar day, from that day's sessions/breaks. Overlapping break
 * intervals are subtracted from the worked intervals they fall inside, and
 * everything else in the window becomes a `gap`. `now` caps open
 * sessions/breaks so a live "still clocked in" render doesn't paint past
 * the current minute.
 */
export function buildDayTimeline(params: {
  sessions: TimelineSession[];
  breaks: TimelineBreak[];
  timezone: string;
  windowStartMin: number;
  windowEndMin: number;
  now: Date;
}): FocusBlock[] {
  const { sessions, breaks, timezone, windowStartMin, windowEndMin, now } = params;
  const nowMin = minutesSinceMidnightInTz(now, timezone);

  const clip = (min: number) => Math.max(windowStartMin, Math.min(windowEndMin, min));

  const workedIntervals = sessions
    .map((s) => {
      const start = minutesSinceMidnightInTz(new Date(s.clockIn), timezone);
      const end = s.clockOut ? minutesSinceMidnightInTz(new Date(s.clockOut), timezone) : nowMin;
      return { start: clip(start), end: clip(end) };
    })
    .filter((i) => i.end > i.start);

  const breakIntervals = breaks
    .map((b) => {
      const start = minutesSinceMidnightInTz(new Date(b.breakStart), timezone);
      const end = b.breakEnd ? minutesSinceMidnightInTz(new Date(b.breakEnd), timezone) : nowMin;
      return { start: clip(start), end: clip(end) };
    })
    .filter((i) => i.end > i.start);

  // Sweep every minute-boundary cut point once, then classify each
  // resulting segment — simpler and more obviously correct than manual
  // interval subtraction for what's a handful of intervals per day.
  const cuts = new Set<number>([windowStartMin, windowEndMin]);
  for (const i of [...workedIntervals, ...breakIntervals]) {
    cuts.add(i.start);
    cuts.add(i.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const blocks: FocusBlock[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const mid = (start + end) / 2;
    const onBreak = breakIntervals.some((b) => mid >= b.start && mid < b.end);
    const worked = workedIntervals.some((w) => mid >= w.start && mid < w.end);
    const kind: FocusBlockKind = onBreak ? "break" : worked ? "worked" : "gap";

    const last = blocks.at(-1);
    if (last && last.kind === kind && last.endMin === start) {
      last.endMin = end;
    } else {
      blocks.push({ startMin: start, endMin: end, kind });
    }
  }
  return blocks;
}
