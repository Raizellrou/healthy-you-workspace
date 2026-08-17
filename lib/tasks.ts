import type { Task } from "@/types/task";

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
