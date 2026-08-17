"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityChip } from "@/components/tasks/PriorityChip";
import { formatDueDate, isOverdue } from "@/lib/tasks";
import type { Task } from "@/types/task";

export function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const dueLabel = formatDueDate(task.due_date);
  const overdue = !task.done && isOverdue(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab space-y-2 rounded-lg border border-line bg-surface p-3 active:cursor-grabbing"
    >
      <Link
        href={`/tasks/${task.id}`}
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
        className={`block text-sm font-medium hover:underline ${
          task.done ? "text-ink-mute line-through" : "text-ink"
        }`}
      >
        {task.title}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityChip priority={task.priority} />
          {task.subtask_count ? (
            <span className="text-xs text-ink-mute">
              {task.subtask_done_count}/{task.subtask_count}
            </span>
          ) : null}
        </div>
        {task.assignee_name ? (
          <Avatar name={task.assignee_name} color={task.assignee_avatar_color ?? "#64748b"} size={24} />
        ) : null}
      </div>
      {dueLabel ? (
        <p className={`text-xs font-medium ${overdue ? "text-risk-critical" : "text-ink-mute"}`}>{dueLabel}</p>
      ) : null}
    </div>
  );
}
