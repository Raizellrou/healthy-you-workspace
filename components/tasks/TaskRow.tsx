"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PriorityChip } from "@/components/tasks/PriorityChip";
import { formatDueDate, isOverdue } from "@/lib/tasks";
import { toggleDone } from "@/app/(app)/tasks/actions";
import type { Task } from "@/types/task";

export function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(task.done);
  const [isPending, startTransition] = useTransition();
  const dueLabel = formatDueDate(task.due_date);
  const overdue = !done && isOverdue(task.due_date);

  function handleToggle() {
    setDone((d) => !d);
    startTransition(async () => {
      const result = await toggleDone(task.id, task.project_id);
      if (!result.ok) {
        setDone((d) => !d);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={handleToggle}
        disabled={isPending}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
          done ? "border-success bg-success" : "border-line bg-surface hover:border-brand"
        }`}
      >
        {done ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </button>

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-ink-mute line-through" : "text-ink"}`}>
          {task.title}
        </p>
        {task.project_name ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: task.project_color }}
              aria-hidden="true"
            />
            {task.project_name}
          </p>
        ) : null}
      </Link>

      {task.subtask_count && !task.done ? (
        <span className="shrink-0 text-xs text-ink-mute">
          {task.subtask_done_count}/{task.subtask_count}
        </span>
      ) : null}

      <PriorityChip priority={task.priority} />

      {dueLabel ? (
        <span className={`shrink-0 text-xs font-medium ${overdue ? "text-risk-critical" : "text-ink-mute"}`}>
          {dueLabel}
        </span>
      ) : null}

      {task.assignee_name ? (
        <Avatar name={task.assignee_name} color={task.assignee_avatar_color ?? "#64748b"} size={28} />
      ) : null}
    </li>
  );
}
