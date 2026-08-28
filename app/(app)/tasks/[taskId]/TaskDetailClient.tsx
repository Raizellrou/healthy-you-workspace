"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { truncateForConfirm } from "@/lib/format";
import { useActionToast } from "@/lib/toast-context";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";
import { BlockerPicker } from "@/components/tasks/BlockerPicker";
import { SubtaskChecklist } from "@/components/tasks/SubtaskChecklist";
import { CommentThread } from "@/components/tasks/CommentThread";
import { EstimateField } from "@/components/tasks/EstimateField";
import { LabelPicker } from "@/components/tasks/LabelPicker";
import { TaskActivity } from "@/components/tasks/TaskActivity";
import { updateTask, toggleDone, setLabels, deleteTask, duplicateTask, setBlockedBy } from "@/app/(app)/tasks/actions";
import type { TaskDetail } from "@/lib/supabase/queries";
import type { TaskRichExtras } from "@/lib/supabase/tasks";
import type { Label, Priority, Task } from "@/types/task";
import type { Employee } from "@/types/employee";

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function TaskDetailClient({
  detail,
  extras,
  allLabels,
  employees,
  blockerCandidates,
  currentEmployeeName,
  currentEmployeeAvatarColor,
  canDelete,
}: {
  detail: TaskDetail;
  extras: TaskRichExtras;
  allLabels: Label[];
  employees: Employee[];
  blockerCandidates: Task[];
  currentEmployeeName?: string;
  currentEmployeeAvatarColor?: string;
  canDelete: boolean;
}) {
  const { task, project, subtasks, comments } = detail;
  const router = useRouter();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [startDate, setStartDate] = useState(extras.startDate ?? "");
  const [estimateHours, setEstimateHours] = useState(extras.estimateHours);
  const [labelIds, setLabelIds] = useState(extras.labels.map((l) => l.id));
  const [done, setDone] = useState(task.done);
  const [blockedById, setBlockedById] = useState(extras.blockedByTask?.id ?? null);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const run = useActionToast();

  const blocker = blockedById ? blockerCandidates.find((t) => t.id === blockedById) : undefined;
  const isBlocked = Boolean(blocker && !blocker.done && !done);

  function save(updates: Partial<Parameters<typeof updateTask>[2]>) {
    startTransition(async () => {
      await updateTask(task.id, task.project_id, updates);
    });
  }

  function handleToggleDone() {
    setDone((d) => !d);
    startTransition(async () => {
      await run(() => toggleDone(task.id, task.project_id), {
        onError: () => setDone((d) => !d),
      });
    });
  }

  function handleBlockedByChange(id: string | null) {
    const previous = blockedById;
    setBlockedById(id);
    startTransition(async () => {
      await run(() => setBlockedBy(task.id, task.project_id, id), {
        onError: () => setBlockedById(previous),
      });
    });
  }

  function handleLabelsChange(ids: string[]) {
    setLabelIds(ids);
    startTransition(async () => {
      await setLabels(task.id, task.project_id, ids);
    });
  }

  function handleDelete() {
    setConfirmDeleteOpen(false);
    startDeleteTransition(async () => {
      const result = await deleteTask(task.id, task.project_id);
      if (result.ok) router.push(`/tasks/project/${task.project_id}/board`);
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await run(() => duplicateTask(task.id, task.project_id), { success: "Task duplicated." });
      if (result.ok && result.id) router.push(`/tasks/${result.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/tasks" className="mb-4 inline-block text-sm text-ink-soft hover:text-ink">
        ← Back to My Tasks
      </Link>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-mute">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
          <Link href={`/tasks/project/${project.id}/board`} className="hover:text-ink">
            {project.name}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleDuplicate} disabled={isPending}>
            Duplicate
          </Button>
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete task"
        message={`Delete "${truncateForConfirm(task.title)}"? This can't be undone.`}
        pending={isDeleting}
      />

      <Card>
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={done ? "Mark not done" : "Mark done"}
            title={isBlocked ? `Blocked by "${blocker!.title}" — that task isn't done yet.` : undefined}
            onClick={handleToggleDone}
            disabled={isPending || isBlocked}
            className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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

        {isBlocked ? (
          <p className="mt-1.5 pl-8 text-xs text-risk-high">
            Blocked by{" "}
            <Link href={`/tasks/${blocker!.id}`} className="underline hover:text-ink">
              {blocker!.title}
            </Link>{" "}
            — can&apos;t be marked done until that task is.
          </p>
        ) : null}

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
            <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Start</span>
            <input
              type="date"
              value={startDate}
              disabled={isPending}
              onChange={(e) => {
                const next = e.target.value;
                setStartDate(next);
                save({ start_date: next || null });
              }}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
            />
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Estimate</span>
            <EstimateField
              value={estimateHours}
              onChange={(hours) => {
                setEstimateHours(hours);
                save({ estimate_hours: hours });
              }}
              disabled={isPending}
            />
          </div>
          {blockerCandidates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">Blocked by</span>
              <BlockerPicker
                candidates={blockerCandidates}
                value={blockedById}
                disabled={isPending}
                onChange={handleBlockedByChange}
              />
            </div>
          )}
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

        {allLabels.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-mute">Labels</div>
            <LabelPicker labels={allLabels} selectedIds={labelIds} onChange={handleLabelsChange} disabled={isPending} />
          </div>
        )}

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

        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-mute">Activity</div>
          <TaskActivity events={extras.events} />
        </div>
      </Card>
    </div>
  );
}
