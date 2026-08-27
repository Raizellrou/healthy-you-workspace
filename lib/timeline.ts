import { eachDay, type IsoDate } from "@/lib/date";
import { estimateOrDefault } from "@/lib/tasks";
import type { Priority } from "@/types/task";

/**
 * Pure timeline math for the P5 Timeline view — a crunch-period detector.
 * No dependency: greedy interval-lane packing plus a per-day commitment
 * sum, both unit-tested in lib/__tests__/timeline.test.ts.
 */

export interface TimelineTaskInput {
  id: string;
  title: string;
  assignee_id: string | null;
  start_date: IsoDate | null;
  due_date: IsoDate | null;
  estimate_hours: number | null;
  priority: Priority;
  done: boolean;
}

export interface TimelineBar {
  taskId: string;
  title: string;
  assigneeId: string | null;
  start: IsoDate;
  end: IsoDate;
  lane: number;
}

/**
 * Greedy interval scheduling: sort by start date, place each bar in the
 * first lane whose last bar already ended before this one starts, or open
 * a new lane. Tasks without a `due_date` are dropped — there's no bar to
 * draw. A task with no `start_date` (or one after its own due date) is
 * rendered as a single-day bar on its due date.
 *
 * Callers group tasks by assignee first and call this once per group — one
 * row per person, lane-packed only within that person's own tasks.
 */
export function layoutBars(tasks: TimelineTaskInput[]): TimelineBar[] {
  const withDates = tasks
    .filter((t): t is TimelineTaskInput & { due_date: IsoDate } => Boolean(t.due_date))
    .map((t) => {
      const end = t.due_date;
      const start = t.start_date && t.start_date <= end ? t.start_date : end;
      return { taskId: t.id, title: t.title, assigneeId: t.assignee_id, start, end };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  const laneEnds: IsoDate[] = [];
  const bars: TimelineBar[] = [];
  for (const b of withDates) {
    let lane = laneEnds.findIndex((end) => end < b.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end);
    } else {
      laneEnds[lane] = b.end;
    }
    bars.push({ ...b, lane });
  }
  return bars;
}

/**
 * Per-day committed hours across `tasks`, spreading each task's estimate
 * evenly across the days it spans (clipped to [rangeStart, rangeEnd]) —
 * the capacity heat strip above the timeline bars. A 12h task spanning 3
 * days contributes 4h/day, not 12h on one day and 0 on the others.
 */
export function dailyCommitment(
  tasks: TimelineTaskInput[],
  rangeStart: IsoDate,
  rangeEnd: IsoDate
): Map<IsoDate, number> {
  const days = eachDay(rangeStart, rangeEnd);
  const totals = new Map<IsoDate, number>(days.map((d) => [d, 0]));

  for (const t of tasks) {
    if (t.done || !t.due_date) continue;
    const end = t.due_date;
    const start = t.start_date && t.start_date <= end ? t.start_date : end;
    const fullSpan = eachDay(start, end);
    const perDay = estimateOrDefault(t) / fullSpan.length;
    for (const d of fullSpan) {
      if (totals.has(d)) totals.set(d, (totals.get(d) ?? 0) + perDay);
    }
  }

  return totals;
}
