import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import { getVisibleEmployees } from "@/lib/supabase/people";
import { buildCapacityWorkload, dueWithin, estimateOrDefault, overdueCount, type CapacityWorkloadEntry } from "@/lib/tasks";
import type { RebalancePerson, RebalanceTask } from "@/lib/rebalance";
import { addDays, type IsoDate } from "@/lib/date";
import type { Label, Task, TaskEvent } from "@/types/task";

/**
 * Sibling to the frozen `lib/supabase/queries.ts`. That file's `select()`
 * column lists are hardcoded to the pre-P3 task shape, so the 0011 columns
 * (estimate_hours, start_date, completed_at, blocked_by), labels, and
 * task_events will never surface through it. This module reads only what
 * queries.ts doesn't — it never re-fetches something that file already owns.
 */

type EmployeeLookup = Map<string, { name: string; avatarColor: string }>;

async function employeeLookup(): Promise<EmployeeLookup> {
  const employees = await getEmployees();
  return new Map(employees.map((e) => [e.id, { name: e.name, avatarColor: e.avatarColor }]));
}

export async function getLabels(): Promise<Label[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labels")
    .select("id, name, color")
    .order("name")
    .returns<Label[]>();
  if (error) {
    throw new Error(`Failed to load labels: ${error.message}`);
  }
  return data ?? [];
}

export interface TaskRichExtras {
  startDate: string | null;
  estimateHours: number | null;
  completedAt: string | null;
  blockedBy: string | null;
  blockedByTask: { id: string; title: string; done: boolean } | null;
  labels: Label[];
  events: TaskEvent[];
}

interface RichTaskColumns {
  start_date: string | null;
  estimate_hours: number | null;
  completed_at: string | null;
  blocked_by: string | null;
}

interface TaskEventRow {
  id: string;
  task_id: string | null;
  actor_id: string;
  kind: TaskEvent["kind"];
  from_value: string | null;
  to_value: string | null;
  is_off_hours: boolean;
  created_at: string;
}

/**
 * The P3 fields for one task, plus its label set and recent activity — the
 * part of the task detail view the frozen `getTaskDetail()` can't return.
 * Callers merge this with `getTaskDetail()`'s result rather than refetching
 * project/subtasks/comments here too.
 */
export async function getTaskRichExtras(taskId: string): Promise<TaskRichExtras | null> {
  const supabase = await createClient();
  const [taskRes, taskLabelRes, eventRes, lookup, labels] = await Promise.all([
    supabase
      .from("tasks")
      .select("start_date, estimate_hours, completed_at, blocked_by")
      .eq("id", taskId)
      .maybeSingle()
      .returns<RichTaskColumns | null>(),
    supabase.from("task_labels").select("label_id").eq("task_id", taskId).returns<{ label_id: string }[]>(),
    supabase
      .from("task_events")
      .select("id, task_id, actor_id, kind, from_value, to_value, is_off_hours, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<TaskEventRow[]>(),
    employeeLookup(),
    getLabels(),
  ]);

  if (taskRes.error) {
    throw new Error(`Failed to load task extras: ${taskRes.error.message}`);
  }
  if (!taskRes.data) return null;

  let blockedByTask: TaskRichExtras["blockedByTask"] = null;
  if (taskRes.data.blocked_by) {
    const { data: blocker } = await supabase
      .from("tasks")
      .select("id, title, done")
      .eq("id", taskRes.data.blocked_by)
      .maybeSingle();
    if (blocker) blockedByTask = blocker;
  }

  const labelMap = new Map(labels.map((l) => [l.id, l]));
  const taskLabels = (taskLabelRes.data ?? [])
    .map((r) => labelMap.get(r.label_id))
    .filter((l): l is Label => Boolean(l));

  const events: TaskEvent[] = (eventRes.data ?? []).map((e) => {
    const actor = lookup.get(e.actor_id);
    return { ...e, actor_name: actor?.name, actor_avatar_color: actor?.avatarColor };
  });

  return {
    startDate: taskRes.data.start_date,
    estimateHours: taskRes.data.estimate_hours,
    completedAt: taskRes.data.completed_at,
    blockedBy: taskRes.data.blocked_by,
    blockedByTask,
    labels: taskLabels,
    events,
  };
}

interface RichTaskRow {
  id: string;
  project_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string;
  priority: Task["priority"];
  due_date: string | null;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  start_date: string | null;
  estimate_hours: number | null;
  completed_at: string | null;
  blocked_by: string | null;
}

const RICH_TASK_COLUMNS =
  "id, project_id, section_id, title, description, assignee_id, created_by, priority, due_date, done, position, created_at, updated_at, start_date, estimate_hours, completed_at, blocked_by";

function toRichTask(
  row: RichTaskRow,
  lookup: EmployeeLookup,
  subtasks: { count: number; done: number } | undefined,
  labels: Label[]
): Task {
  const assignee = row.assignee_id ? lookup.get(row.assignee_id) : undefined;
  return {
    id: row.id,
    project_id: row.project_id,
    section_id: row.section_id,
    title: row.title,
    description: row.description,
    assignee_id: row.assignee_id,
    created_by: row.created_by,
    priority: row.priority,
    due_date: row.due_date,
    done: row.done,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    start_date: row.start_date,
    estimate_hours: row.estimate_hours,
    completed_at: row.completed_at,
    blocked_by: row.blocked_by,
    assignee_name: assignee?.name,
    assignee_avatar_color: assignee?.avatarColor,
    subtask_count: subtasks?.count ?? 0,
    subtask_done_count: subtasks?.done ?? 0,
    labels,
  };
}

/**
 * Superset of the frozen `getTasksForProject()`: same board query, plus the
 * P3 columns and each task's labels, so board cards can show an estimate
 * badge and label chips instead of just title/priority/assignee.
 */
export async function getTasksForProjectRich(projectId: string): Promise<Task[]> {
  const supabase = await createClient();
  const [tasksRes, lookup, labels] = await Promise.all([
    supabase.from("tasks").select(RICH_TASK_COLUMNS).eq("project_id", projectId).returns<RichTaskRow[]>(),
    employeeLookup(),
    getLabels(),
  ]);
  if (tasksRes.error) {
    throw new Error(`Failed to load tasks: ${tasksRes.error.message}`);
  }
  const rows = tasksRes.data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [subtaskRes, taskLabelRes] = await Promise.all([
    supabase.from("subtasks").select("task_id, done").in("task_id", ids).returns<{ task_id: string; done: boolean }[]>(),
    supabase
      .from("task_labels")
      .select("task_id, label_id")
      .in("task_id", ids)
      .returns<{ task_id: string; label_id: string }[]>(),
  ]);
  if (subtaskRes.error) {
    throw new Error(`Failed to load subtasks: ${subtaskRes.error.message}`);
  }

  const subtaskCounts = new Map<string, { count: number; done: number }>();
  for (const s of subtaskRes.data ?? []) {
    const cur = subtaskCounts.get(s.task_id) ?? { count: 0, done: 0 };
    cur.count++;
    if (s.done) cur.done++;
    subtaskCounts.set(s.task_id, cur);
  }

  const labelMap = new Map(labels.map((l) => [l.id, l]));
  const taskLabels = new Map<string, Label[]>();
  for (const tl of taskLabelRes.data ?? []) {
    const label = labelMap.get(tl.label_id);
    if (!label) continue;
    const list = taskLabels.get(tl.task_id) ?? [];
    list.push(label);
    taskLabels.set(tl.task_id, list);
  }

  return rows.map((r) => toRichTask(r, lookup, subtaskCounts.get(r.id), taskLabels.get(r.id) ?? []));
}

interface OpenTaskRow {
  id: string;
  title: string;
  assignee_id: string | null;
  priority: Task["priority"];
  done: boolean;
  estimate_hours: number | null;
  due_date: string | null;
}

/**
 * Capacity-based Workload: committed hours as a % of each visible person's
 * weekly_capacity_hours, replacing the frozen `getWorkload()`'s raw open-task
 * count. Scoping comes from `getVisibleEmployees()` (self/team/org per
 * 0010's RLS) — task rows themselves are org-readable, but only people the
 * caller can see end up with an entry, since the output is built by mapping
 * over the people list, not the task list.
 *
 * Also returns two things lib/rebalance.ts#suggestRebalanceMoves needs that
 * the display aggregates (`entries`) don't provide:
 *
 * - the raw open-task rows (task-level data, not per-person totals, to
 *   propose which task should move)
 * - `people`, every visible person's committed hours *unfiltered* by
 *   open_count. `entries` goes through buildCapacityWorkload's
 *   `.filter(open_count > 0)` — right for the bar chart (a 0-task person
 *   doesn't need a bar), wrong for rebalancing: someone with zero open
 *   tasks is the best possible receiver for an overloaded person's work,
 *   and dropping them from the candidate pool here was a live-caught bug
 *   (P8 verification: three teammates sat at 0h and were invisible to the
 *   suggester, which offered the person already at 2h instead).
 */
export async function getRebalanceCandidates(): Promise<{
  entries: CapacityWorkloadEntry[];
  people: RebalancePerson[];
  tasks: RebalanceTask[];
}> {
  const supabase = await createClient();
  const [tasksRes, people] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, assignee_id, priority, done, estimate_hours, due_date")
      .eq("done", false)
      .returns<OpenTaskRow[]>(),
    getVisibleEmployees(),
  ]);
  if (tasksRes.error) {
    throw new Error(`Failed to load tasks for rebalance: ${tasksRes.error.message}`);
  }

  const visibleIds = new Set(people.map((p) => p.id));
  const openTasks = (tasksRes.data ?? []).filter((t) => t.assignee_id && visibleIds.has(t.assignee_id));

  const entries = buildCapacityWorkload(
    openTasks,
    people.map((p) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      weeklyCapacityHours: p.weeklyCapacityHours,
    }))
  );

  const committedByEmployee = new Map<string, number>();
  for (const t of openTasks) {
    const id = t.assignee_id as string;
    committedByEmployee.set(id, (committedByEmployee.get(id) ?? 0) + estimateOrDefault(t));
  }
  const rebalancePeople: RebalancePerson[] = people.map((p) => ({
    employeeId: p.id,
    name: p.name,
    committedHours: Math.round((committedByEmployee.get(p.id) ?? 0) * 10) / 10,
    capacityHours: p.weeklyCapacityHours,
  }));

  const tasks: RebalanceTask[] = openTasks.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeId: t.assignee_id as string,
    estimateHours: estimateOrDefault(t),
  }));

  return { entries, people: rebalancePeople, tasks };
}

export interface TaskViewSummary {
  id: string;
  name: string;
  layout: "list" | "board" | "calendar" | "timeline";
  filters: Record<string, string>;
  isShared: boolean;
  ownerId: string;
}

interface TaskViewRow {
  id: string;
  name: string;
  layout: TaskViewSummary["layout"];
  filters: Record<string, string>;
  is_shared: boolean;
  owner_id: string;
}

/** Saved views for one project's List/Board/Calendar/Timeline switcher
 *  (0013_task_views.sql) — RLS already scopes this to the caller's own
 *  views plus anyone else's marked shared, so no extra filtering here. */
export async function getTaskViews(projectId: string): Promise<TaskViewSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_views")
    .select("id, name, layout, filters, is_shared, owner_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<TaskViewRow[]>();
  if (error) {
    throw new Error(`Failed to load saved views: ${error.message}`);
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    layout: r.layout,
    filters: r.filters,
    isShared: r.is_shared,
    ownerId: r.owner_id,
  }));
}

export interface TaskBurnoutSignals {
  /** Sum of estimateOrDefault() over this person's open tasks due within 7 days. */
  committedHours: number;
  overdueTaskCount: number;
}

const EMPTY_TASK_SIGNALS: TaskBurnoutSignals = { committedHours: 0, overdueTaskCount: 0 };

/**
 * Bulk task-load signals for burnout v2 (lib/burnout-signals.ts), one query
 * for every employee rather than one per person — the task-side counterpart
 * to lib/supabase/attendance.ts#getAttendanceSignals.
 */
export async function getTaskBurnoutSignals(
  employeeIds: string[],
  today: IsoDate
): Promise<Map<string, TaskBurnoutSignals>> {
  if (employeeIds.length === 0) return new Map();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("assignee_id, priority, done, estimate_hours, due_date")
    .in("assignee_id", employeeIds)
    .eq("done", false)
    .returns<OpenTaskRow[]>();
  if (error) {
    throw new Error(`Failed to load tasks for burnout signals: ${error.message}`);
  }

  const byEmployee = new Map<string, OpenTaskRow[]>();
  for (const t of data ?? []) {
    if (!t.assignee_id) continue;
    const list = byEmployee.get(t.assignee_id) ?? [];
    list.push(t);
    byEmployee.set(t.assignee_id, list);
  }

  const out = new Map<string, TaskBurnoutSignals>();
  for (const employeeId of employeeIds) {
    const tasks = byEmployee.get(employeeId);
    if (!tasks) {
      out.set(employeeId, EMPTY_TASK_SIGNALS);
      continue;
    }
    const committedHours = dueWithin(tasks, 7, today).reduce((sum, t) => sum + estimateOrDefault(t), 0);
    out.set(employeeId, {
      committedHours: Math.round(committedHours * 10) / 10,
      overdueTaskCount: overdueCount(tasks),
    });
  }

  return out;
}

/**
 * Count of this employee's open tasks due on each of the next `days`
 * calendar days (tomorrow first) — the burnout forecast's (lib/forecast.ts)
 * look-ahead overdue signal. A task due on day N isn't overdue on day N
 * itself; forecastNext7Days is what turns "due on day N" into "overdue
 * from day N+1", not this query — this just counts by due_date.
 */
export async function getUpcomingDueTaskCounts(employeeId: string, today: IsoDate, days = 7): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("assignee_id", employeeId)
    .eq("done", false)
    .gt("due_date", today)
    .lte("due_date", addDays(today, days))
    .returns<{ due_date: IsoDate | null }[]>();
  if (error) {
    throw new Error(`Failed to load upcoming due tasks: ${error.message}`);
  }

  const countByDate = new Map<IsoDate, number>();
  for (const row of data ?? []) {
    if (!row.due_date) continue;
    countByDate.set(row.due_date, (countByDate.get(row.due_date) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, i) => countByDate.get(addDays(today, i + 1)) ?? 0);
}
