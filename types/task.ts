export type Priority = "low" | "medium" | "high";

export interface Project {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface BoardSection {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  project_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string;
  priority: Priority;
  due_date: string | null;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  // Added in P3 (0011_task_engine.sql). Optional because the frozen
  // queries.ts read paths (getTasksForProject, getMyTasks) don't select
  // them — only the sibling lib/supabase/tasks.ts reads do.
  start_date?: string | null;
  estimate_hours?: number | null;
  completed_at?: string | null;
  blocked_by?: string | null;
  // joined fields (not stored on the task row) — populated by the query
  // layer to avoid N+1 fetches in list/board views
  assignee_name?: string;
  assignee_avatar_color?: string;
  subtask_count?: number;
  subtask_done_count?: number;
  project_name?: string;
  project_color?: string;
  labels?: Label[];
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export type TaskEventKind =
  | "created"
  | "completed"
  | "reopened"
  | "assigned"
  | "unassigned"
  | "moved"
  | "commented"
  | "due_changed"
  | "priority_changed"
  | "estimate_changed"
  | "deleted";

export interface TaskEvent {
  id: string;
  task_id: string | null;
  actor_id: string;
  kind: TaskEventKind;
  from_value: string | null;
  to_value: string | null;
  is_off_hours: boolean;
  created_at: string;
  actor_name?: string;
  actor_avatar_color?: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_avatar_color?: string;
}
