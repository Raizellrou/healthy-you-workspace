import Link from "next/link";
import { PriorityChip } from "@/components/tasks/PriorityChip";
import { formatDueDate, isOverdue, sortByDueDate } from "@/lib/tasks";
import type { Task } from "@/types/task";

/**
 * The neurodivergent-friendly lens: single column, no drag targets, no
 * avatars, dense text, fully keyboard-navigable (plain links, not
 * dnd-kit's pointer-driven cards). No client state at all — this can stay
 * a Server Component.
 */
export function ListView({ tasks }: { tasks: Task[] }) {
  const sorted = sortByDueDate(tasks);

  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-mute">No tasks match these filters.</p>;
  }

  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {sorted.map((task) => {
        const dueLabel = formatDueDate(task.due_date);
        const overdue = !task.done && isOverdue(task.due_date);
        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.done ? "bg-success" : "bg-line"}`}
                aria-hidden="true"
              />
              <span className={`min-w-0 flex-1 truncate ${task.done ? "text-ink-mute line-through" : "text-ink"}`}>
                {task.title}
              </span>
              <PriorityChip priority={task.priority} />
              <span className="w-28 shrink-0 truncate text-xs text-ink-mute">{task.assignee_name ?? ""}</span>
              <span
                className={`w-16 shrink-0 text-right text-xs font-medium ${overdue ? "text-risk-critical" : "text-ink-mute"}`}
              >
                {dueLabel ?? ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
