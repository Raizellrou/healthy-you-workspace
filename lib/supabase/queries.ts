import { createClient } from "@/lib/supabase/server";
import { computeBurnout } from "@/lib/burnout";
import { buildWorkload, sortByDueDate, type WorkloadEntry } from "@/lib/tasks";
import type { Employee } from "@/types/employee";
import type { Project, BoardSection, Task, Priority, Subtask, TaskComment } from "@/types/task";

const AVATAR_PALETTE = [
  "#0ea5e9",
  "#0369a1",
  "#7c3aed",
  "#0d9488",
  "#c026d3",
  "#4338ca",
  "#0891b2",
  "#9333ea",
] as const;

interface EmployeeRow {
  id: string;
  name: string;
  team: string;
  role: string;
  email: string;
}

interface DailyActivityRow {
  employee_id: string;
  date: string;
  meeting_hours: number;
  available_hours: number;
  off_hours_messages: number;
  worked_today: boolean;
  on_pto: boolean;
}

interface DerivedStats {
  worked: boolean;
  meeting: number;
  offHours: number;
  available: number;
  onPto: boolean;
  meetingAvg: number;
  streakDays: number;
  daysSincePto: number;
  offHoursWeekly: number;
}

const EMPTY_STATS: DerivedStats = {
  worked: false,
  meeting: 0,
  offHours: 0,
  available: 8,
  onPto: false,
  meetingAvg: 0,
  streakDays: 0,
  daysSincePto: 0,
  offHoursWeekly: 0,
};

// `rows` must be sorted descending by date (most recent first) and non-empty.
function deriveStats(rows: DailyActivityRow[]): DerivedStats {
  const latest = rows[0];

  // Streak: consecutive trailing days actually worked (not PTO), counting
  // back from the most recent day until the first gap.
  let streakDays = 0;
  for (const r of rows) {
    if (r.worked_today && !r.on_pto) streakDays++;
    else break;
  }

  // Days since PTO: distance back to the most recent on_pto day within the
  // history window. Falls back to the full window length if no PTO day
  // appears at all in the available history.
  let daysSincePto = rows.length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].on_pto) {
      daysSincePto = i;
      break;
    }
  }

  // Meeting load average, over the whole window including PTO/off days as
  // zero — this is a utilization-style average (how much of total capacity
  // over the period went to meetings), not just "average on days worked."
  const meetingAvg =
    rows.reduce((sum, r) => sum + r.meeting_hours, 0) / rows.length;

  const offHoursWeekly = rows
    .slice(0, 7)
    .reduce((sum, r) => sum + r.off_hours_messages, 0);

  return {
    worked: latest.worked_today,
    meeting: latest.meeting_hours,
    offHours: latest.off_hours_messages,
    available: latest.available_hours || 8,
    onPto: latest.on_pto,
    meetingAvg,
    streakDays,
    daysSincePto,
    offHoursWeekly,
  };
}

function toEmployee(row: EmployeeRow, index: number, stats: DerivedStats): Employee {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    role: row.role,
    email: row.email,
    avatarColor: AVATAR_PALETTE[index % AVATAR_PALETTE.length],
    // No PTO-return-date column exists in this schema yet — always null
    // until that's tracked. UI treats a null returnIn as "on PTO, no ETA."
    returnIn: null,
    ...stats,
  };
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const [employeesRes, activityRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, team, role, email")
      .order("name")
      .returns<EmployeeRow[]>(),
    supabase
      .from("daily_activity")
      .select("employee_id, date, meeting_hours, available_hours, off_hours_messages, worked_today, on_pto")
      .order("date", { ascending: false })
      .returns<DailyActivityRow[]>(),
  ]);

  if (employeesRes.error) {
    throw new Error(`Failed to load employees: ${employeesRes.error.message}`);
  }
  if (activityRes.error) {
    throw new Error(`Failed to load daily_activity: ${activityRes.error.message}`);
  }

  const activityByEmployee = new Map<string, DailyActivityRow[]>();
  for (const row of activityRes.data ?? []) {
    const list = activityByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    activityByEmployee.set(row.employee_id, list);
  }

  return (employeesRes.data ?? []).map((row, i) => {
    const rows = activityByEmployee.get(row.id);
    const stats = rows && rows.length > 0 ? deriveStats(rows) : EMPTY_STATS;
    return toEmployee(row, i, stats);
  });
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const employees = await getEmployees();
  return employees.find((e) => e.id === id);
}

// Resolves the logged-in session to their employees.id — server actions
// derive identity from this, never from client-supplied values, so a
// request can never act as anyone but the authenticated caller.
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export interface BurnoutHistoryPoint {
  date: string;
  composite: number;
}

// risk_scores only ever holds one current snapshot row per employee (not a
// daily log), so it can't supply a real trend on its own. Instead, this
// reconstructs a genuine 14-day trend by re-running computeBurnout() against
// a trailing daily_activity window ending on each of the last `days` dates —
// real derived history from real data, not a fabrication.
export async function getBurnoutHistory(
  employeeId: string,
  days = 14
): Promise<BurnoutHistoryPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date, meeting_hours, available_hours, off_hours_messages, worked_today, on_pto")
    .eq("employee_id", employeeId)
    .order("date", { ascending: false })
    .returns<DailyActivityRow[]>();

  if (error) {
    throw new Error(`Failed to load daily_activity history: ${error.message}`);
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const targetDates = rows.slice(0, days).map((r) => r.date);

  const points = targetDates.map((date) => {
    const windowRows = rows.filter((r) => r.date <= date);
    const stats = deriveStats(windowRows);
    const { composite } = computeBurnout(stats);
    return { date, composite };
  });

  return points.reverse();
}

// --- Tasks pillar ---

interface TaskRow {
  id: string;
  project_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string;
  priority: string;
  due_date: string | null;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

type EmployeeLookup = Map<string, { name: string; avatarColor: string }>;

async function getEmployeeLookup(): Promise<EmployeeLookup> {
  const employees = await getEmployees();
  return new Map(employees.map((e) => [e.id, { name: e.name, avatarColor: e.avatarColor }]));
}

function toTask(
  row: TaskRow,
  employeeLookup: EmployeeLookup,
  subtasks?: { count: number; done: number }
): Task {
  const assignee = row.assignee_id ? employeeLookup.get(row.assignee_id) : undefined;
  return {
    id: row.id,
    project_id: row.project_id,
    section_id: row.section_id,
    title: row.title,
    description: row.description,
    assignee_id: row.assignee_id,
    created_by: row.created_by,
    priority: row.priority as Priority,
    due_date: row.due_date,
    done: row.done,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignee_name: assignee?.name,
    assignee_avatar_color: assignee?.avatarColor,
    subtask_count: subtasks?.count ?? 0,
    subtask_done_count: subtasks?.done ?? 0,
  };
}

// Fetches subtask counts for a set of task ids in one query and joins them
// onto the already-fetched task rows — same "join in TS, not SQL" approach
// used throughout this file.
async function attachSubtaskCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: TaskRow[],
  employeeLookup: EmployeeLookup
): Promise<Task[]> {
  if (rows.length === 0) return [];

  const { data: subtaskRows, error } = await supabase
    .from("subtasks")
    .select("task_id, done")
    .in("task_id", rows.map((r) => r.id))
    .returns<{ task_id: string; done: boolean }[]>();
  if (error) {
    throw new Error(`Failed to load subtasks: ${error.message}`);
  }

  const counts = new Map<string, { count: number; done: number }>();
  for (const s of subtaskRows ?? []) {
    const cur = counts.get(s.task_id) ?? { count: 0, done: 0 };
    cur.count++;
    if (s.done) cur.done++;
    counts.set(s.task_id, cur);
  }

  return rows.map((r) => toTask(r, employeeLookup, counts.get(r.id)));
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, color, created_at")
    .order("created_at")
    .returns<Project[]>();

  if (error) {
    throw new Error(`Failed to load projects: ${error.message}`);
  }
  return data ?? [];
}

export async function getProject(
  id: string
): Promise<{ project: Project; sections: BoardSection[] } | null> {
  const supabase = await createClient();
  const [projectRes, sectionsRes] = await Promise.all([
    supabase.from("projects").select("id, name, color, created_at").eq("id", id).maybeSingle().returns<Project | null>(),
    supabase
      .from("board_sections")
      .select("id, project_id, name, position")
      .eq("project_id", id)
      .order("position")
      .returns<BoardSection[]>(),
  ]);

  if (projectRes.error) {
    throw new Error(`Failed to load project: ${projectRes.error.message}`);
  }
  if (sectionsRes.error) {
    throw new Error(`Failed to load board_sections: ${sectionsRes.error.message}`);
  }
  if (!projectRes.data) return null;

  return { project: projectRes.data, sections: sectionsRes.data ?? [] };
}

export async function getTasksForProject(projectId: string): Promise<Task[]> {
  const supabase = await createClient();
  const [tasksRes, employeeLookup] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, section_id, title, description, assignee_id, created_by, priority, due_date, done, position, created_at, updated_at"
      )
      .eq("project_id", projectId)
      .returns<TaskRow[]>(),
    getEmployeeLookup(),
  ]);

  if (tasksRes.error) {
    throw new Error(`Failed to load tasks: ${tasksRes.error.message}`);
  }

  return attachSubtaskCounts(supabase, tasksRes.data ?? [], employeeLookup);
}

// Tasks assigned to `employeeId`, across every project, not yet done —
// sorted via lib/tasks.ts#sortByDueDate so this list and the pure sorting
// logic can never diverge.
export async function getMyTasks(employeeId: string): Promise<Task[]> {
  const supabase = await createClient();
  const [tasksRes, employeeLookup, projects] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, section_id, title, description, assignee_id, created_by, priority, due_date, done, position, created_at, updated_at"
      )
      .eq("assignee_id", employeeId)
      .eq("done", false)
      .returns<TaskRow[]>(),
    getEmployeeLookup(),
    getProjects(),
  ]);

  if (tasksRes.error) {
    throw new Error(`Failed to load my tasks: ${tasksRes.error.message}`);
  }

  const projectLookup = new Map(projects.map((p) => [p.id, p]));
  const tasks = await attachSubtaskCounts(supabase, tasksRes.data ?? [], employeeLookup);
  const withProject = tasks.map((t) => {
    const project = projectLookup.get(t.project_id);
    return { ...t, project_name: project?.name, project_color: project?.color };
  });
  return sortByDueDate(withProject);
}

// Open (not-done) task count per employee, grouped in TS via
// lib/tasks.ts#buildWorkload — same "aggregate in TS, not a DB view"
// approach getEmployees()/deriveStats() already use.
export async function getWorkload(): Promise<WorkloadEntry[]> {
  const supabase = await createClient();
  const [tasksRes, employees] = await Promise.all([
    supabase
      .from("tasks")
      .select("assignee_id, priority, done")
      .eq("done", false)
      .returns<{ assignee_id: string | null; priority: string; done: boolean }[]>(),
    getEmployees(),
  ]);

  if (tasksRes.error) {
    throw new Error(`Failed to load tasks for workload: ${tasksRes.error.message}`);
  }

  const tasks = (tasksRes.data ?? []).map((t) => ({
    assignee_id: t.assignee_id,
    priority: t.priority as Priority,
    done: t.done,
  }));

  return buildWorkload(tasks, employees);
}

interface TaskCommentRow {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface TaskDetail {
  task: Task;
  project: Project;
  sections: BoardSection[];
  subtasks: Subtask[];
  comments: TaskComment[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const [taskRes, employeeLookup] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, section_id, title, description, assignee_id, created_by, priority, due_date, done, position, created_at, updated_at"
      )
      .eq("id", taskId)
      .maybeSingle()
      .returns<TaskRow | null>(),
    getEmployeeLookup(),
  ]);

  if (taskRes.error) {
    throw new Error(`Failed to load task: ${taskRes.error.message}`);
  }
  if (!taskRes.data) return null;

  const [projectResult, subtasksRes, commentsRes] = await Promise.all([
    getProject(taskRes.data.project_id),
    supabase
      .from("subtasks")
      .select("id, task_id, title, done, position")
      .eq("task_id", taskId)
      .order("position")
      .returns<Subtask[]>(),
    supabase
      .from("task_comments")
      .select("id, task_id, author_id, body, created_at")
      .eq("task_id", taskId)
      .order("created_at")
      .returns<TaskCommentRow[]>(),
  ]);

  if (subtasksRes.error) {
    throw new Error(`Failed to load subtasks: ${subtasksRes.error.message}`);
  }
  if (commentsRes.error) {
    throw new Error(`Failed to load comments: ${commentsRes.error.message}`);
  }
  if (!projectResult) return null;

  const subtasks = subtasksRes.data ?? [];
  const task = toTask(taskRes.data, employeeLookup, {
    count: subtasks.length,
    done: subtasks.filter((s) => s.done).length,
  });

  const comments: TaskComment[] = (commentsRes.data ?? []).map((c) => {
    const author = employeeLookup.get(c.author_id);
    return { ...c, author_name: author?.name, author_avatar_color: author?.avatarColor };
  });

  return { task, project: projectResult.project, sections: projectResult.sections, subtasks, comments };
}
