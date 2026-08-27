import type { Priority, Task } from "@/types/task";
import { addDays, dateInTz, isWeekend, minutesSinceMidnightInTz, type IsoDate } from "@/lib/date";
import { WORK_END_MIN, WORK_START_MIN } from "@/lib/constants";

export function sortByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}

export function groupBySection(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.section_id ?? "__unsectioned__";
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position);
  return map;
}

export interface WorkloadEntry {
  employee_id: string;
  name: string;
  avatar_color: string;
  open_count: number;
  high_count: number;
}

export type WorkloadTaskInput = Pick<Task, "assignee_id" | "priority" | "done">;

export function buildWorkload(
  tasks: WorkloadTaskInput[],
  employees: { id: string; name: string; avatarColor: string }[]
): WorkloadEntry[] {
  const byEmployee = new Map<string, { open: number; high: number }>();
  for (const t of tasks) {
    if (t.done || !t.assignee_id) continue;
    const cur = byEmployee.get(t.assignee_id) ?? { open: 0, high: 0 };
    cur.open++;
    if (t.priority === "high") cur.high++;
    byEmployee.set(t.assignee_id, cur);
  }
  return employees
    .map((e) => {
      const stats = byEmployee.get(e.id) ?? { open: 0, high: 0 };
      return {
        employee_id: e.id,
        name: e.name,
        avatar_color: e.avatarColor,
        open_count: stats.open,
        high_count: stats.high,
      };
    })
    .filter((e) => e.open_count > 0)
    .sort((a, b) => b.open_count - a.open_count);
}

export function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const date = new Date(`${dueDate}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

// Sequential integer reindexing (1, 2, 3...) after a drag-and-drop reorder.
// Correct and simple at this scale (≤24 people, well under 100 tasks per
// section) — no fractional-indexing complexity needed.
export function reindexPositions<T extends { position: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, position: i }));
}

// P3: the task engine. These feed Workload (capacity-based, not a raw open
// count) and, later, burnout v2's task-load/overdue/recovery factors — all
// pure and unit-tested so that composition stays safe to extend.

const DEFAULT_ESTIMATE_HOURS: Record<Priority, number> = { high: 4, medium: 2, low: 1 };

/** An explicit estimate if one was set, otherwise a priority-based default —
 *  what makes Workload meaningful before every task has a real estimate. */
export function estimateOrDefault(task: Pick<Task, "estimate_hours" | "priority">): number {
  return task.estimate_hours ?? DEFAULT_ESTIMATE_HOURS[task.priority];
}

/** Committed hours as a percentage of weekly capacity. Uncapped (a person at
 *  250% is a more useful number on a manager's screen than one silently
 *  clamped to 100%) but never negative or divided by a zero/blank capacity. */
export function capacityLoad(committedHours: number, weeklyCapacityHours: number): number {
  if (weeklyCapacityHours <= 0) return 0;
  return Math.max(0, Math.round((committedHours / weeklyCapacityHours) * 100));
}

export function overdueCount(tasks: Pick<Task, "done" | "due_date">[]): number {
  return tasks.filter((t) => !t.done && isOverdue(t.due_date)).length;
}

/** Open tasks due within `days` of `today`, today included. */
export function dueWithin<T extends Pick<Task, "done" | "due_date">>(
  tasks: T[],
  days: number,
  today: IsoDate
): T[] {
  const cutoff = addDays(today, days);
  return tasks.filter((t) => !t.done && t.due_date && t.due_date >= today && t.due_date <= cutoff);
}

export interface CapacityWorkloadEntry {
  employee_id: string;
  name: string;
  avatar_color: string;
  committed_hours: number;
  capacity_hours: number;
  load_pct: number;
  open_count: number;
  overdue_count: number;
}

export type CapacityWorkloadTaskInput = Pick<
  Task,
  "assignee_id" | "priority" | "done" | "estimate_hours" | "due_date"
>;

/** Capacity-aware replacement for the plain open-task-count workload: each
 *  person's bar is % of their own weekly_capacity_hours, not a raw count
 *  that treats a 30-minute task the same as a 2-day one. */
export function buildCapacityWorkload(
  tasks: CapacityWorkloadTaskInput[],
  people: { id: string; name: string; avatarColor: string; weeklyCapacityHours: number }[]
): CapacityWorkloadEntry[] {
  const byEmployee = new Map<string, { hours: number; open: number; overdue: number }>();
  for (const t of tasks) {
    if (t.done || !t.assignee_id) continue;
    const cur = byEmployee.get(t.assignee_id) ?? { hours: 0, open: 0, overdue: 0 };
    cur.hours += estimateOrDefault(t);
    cur.open++;
    if (isOverdue(t.due_date)) cur.overdue++;
    byEmployee.set(t.assignee_id, cur);
  }
  return people
    .map((p) => {
      const stats = byEmployee.get(p.id) ?? { hours: 0, open: 0, overdue: 0 };
      const committed_hours = Math.round(stats.hours * 10) / 10;
      return {
        employee_id: p.id,
        name: p.name,
        avatar_color: p.avatarColor,
        committed_hours,
        capacity_hours: p.weeklyCapacityHours,
        load_pct: capacityLoad(committed_hours, p.weeklyCapacityHours),
        open_count: stats.open,
        overdue_count: stats.overdue,
      };
    })
    .filter((e) => e.open_count > 0)
    .sort((a, b) => b.load_pct - a.load_pct);
}

export interface TaskFilters {
  q?: string;
  assigneeId?: string;
  priority?: Priority;
  labelId?: string;
}

/**
 * The single filter pass every P5 view (List/Board/Calendar/Timeline)
 * shares — filter state lives in the URL's searchParams, not React state,
 * so a filtered view is just a link. Search is plain substring matching on
 * title/description; at this project's scale (well under 100 tasks per
 * project) a tsvector index would be over-engineering.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const needle = filters.q?.trim().toLowerCase();
  return tasks.filter((t) => {
    if (needle) {
      const haystack = `${t.title} ${t.description ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filters.assigneeId && t.assignee_id !== filters.assigneeId) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.labelId && !(t.labels ?? []).some((l) => l.id === filters.labelId)) return false;
    return true;
  });
}

/** True when `instant` (as seen in `timezone`) falls outside the standard
 *  work window or on a weekend — the definition task_events.is_off_hours
 *  uses, mirroring the WORK_START_MIN/WORK_END_MIN window lib/boundary.ts
 *  already applies to messages, now applied to task activity too. */
export function isOffHoursMoment(instant: Date, timezone: string): boolean {
  if (isWeekend(dateInTz(instant, timezone))) return true;
  const minutes = minutesSinceMidnightInTz(instant, timezone);
  return minutes < WORK_START_MIN || minutes >= WORK_END_MIN;
}
