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
  // joined fields (not stored on the task row) — populated by the query
  // layer to avoid N+1 fetches in list/board views
  assignee_name?: string;
  assignee_avatar_color?: string;
  subtask_count?: number;
  subtask_done_count?: number;
  project_name?: string;
  project_color?: string;
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
