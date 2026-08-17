"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";
import { SubtaskChecklist } from "@/components/tasks/SubtaskChecklist";
import { CommentThread } from "@/components/tasks/CommentThread";
import { updateTask, toggleDone } from "@/app/(app)/tasks/actions";
import type { TaskDetail } from "@/lib/supabase/queries";
import type { Priority } from "@/types/task";
import type { Employee } from "@/types/employee";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function TaskDetailClient({
  detail,
  employees,
  currentEmployeeName,
  currentEmployeeAvatarColor,
}: {
  detail: TaskDetail;
  employees: Employee[];
  currentEmployeeName?: string;
  currentEmployeeAvatarColor?: string;
}) {
  const { task, project, subtasks, comments } = detail;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [done, setDone] = useState(task.done);
  const [isPending, startTransition] = useTransition();

  function save(updates: Partial<Parameters<typeof updateTask>[2]>) {
    startTransition(async () => {
      await updateTask(task.id, task.project_id, updates);
    });
  }

  function handleToggleDone() {
    setDone((d) => !d);
    startTransition(async () => {
      await toggleDone(task.id, task.project_id);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/tasks" className="mb-4 inline-block text-sm text-ink-soft hover:text-ink">
        ← Back to My Tasks
      </Link>

      <div className="mb-4 flex items-center gap-2 text-sm text-ink-mute">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
        <Link href={`/tasks/board/${project.id}`} className="hover:text-ink">
          {project.name}
        </Link>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "Mark not done" : "Mark done"}
            onClick={handleToggleDone}
            disabled={isPending}
            className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
              done ? "border-success bg-success" : "border-line bg-surface hover:border-brand"
            }`}
          >
            {done ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) save({ title: title.trim() });
            }}
            className={`w-full border-none bg-transparent text-lg font-semibold text-ink outline-none ${
              done ? "text-ink-mute line-through" : ""
            }`}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Assignee</span>
            <AssigneePicker
              employees={employees}
              value={assigneeId}
              disabled={isPending}
              onChange={(id) => {
                setAssigneeId(id);
                save({ assignee_id: id });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Priority</span>
            <select
              value={priority}
              disabled={isPending}
              onChange={(e) => {
                const next = e.target.value as Priority;
                setPriority(next);
                save({ priority: next });
              }}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Due</span>
            <input
              type="date"
              value={dueDate}
              disabled={isPending}
              onChange={(e) => {
                const next = e.target.value;
                setDueDate(next);
                save({ due_date: next || null });
              }}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="task-description" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (task.description ?? "")) save({ description: description.trim() || null });
            }}
            rows={3}
            placeholder="Add more detail…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <SubtaskChecklist taskId={task.id} projectId={task.project_id} subtasks={subtasks} />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <CommentThread
            taskId={task.id}
            projectId={task.project_id}
            comments={comments}
            currentEmployeeName={currentEmployeeName}
            currentEmployeeAvatarColor={currentEmployeeAvatarColor}
          />
        </div>
      </Card>
    </div>
  );
}
