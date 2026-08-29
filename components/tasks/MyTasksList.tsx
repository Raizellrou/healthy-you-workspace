"use client";

import { useState, useTransition } from "react";
import { TaskRow } from "@/components/tasks/TaskRow";
import { AssigneePicker } from "@/components/tasks/AssigneePicker";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { ConfirmModal } from "@/components/ui/Modal";
import { bulkReassign, bulkClose } from "@/app/(app)/tasks/actions";
import type { Task } from "@/types/task";
import type { Employee } from "@/types/employee";

/**
 * My Tasks spans every project the caller has a task in, so selection here
 * is cross-project by nature — bulkReassign/bulkClose (actions.ts) derive
 * which projects to revalidate from the rows themselves rather than taking
 * a single projectId from this component.
 *
 * `selected` is reconciled against the current `tasks` prop on every
 * render (see `selectedIds` below) rather than trusted as-is: once a bulk
 * close revalidates and a task drops out of `tasks` (getMyTasks filters to
 * `done = false`), a stale id left in `selected` just stops matching
 * anything instead of inflating the displayed count.
 */
export function MyTasksList({ tasks, employees }: { tasks: Task[]; employees: Employee[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const selectedIds = tasks.filter((t) => selected.has(t.id)).map((t) => t.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
    setError(null);
  }

  function handleReassign(employeeId: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await bulkReassign(selectedIds, employeeId);
      if (result.ok) {
        clear();
      } else {
        setError(result.error ?? "Couldn't reassign those tasks.");
      }
    });
  }

  function handleClose() {
    setConfirmCloseOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await bulkClose(selectedIds);
      if (!result.ok) {
        setError(result.error ?? "Couldn't close those tasks.");
        return;
      }
      if (result.skipped) {
        // Leave selection as-is — the closed tasks drop out of `tasks` on
        // revalidation and self-prune from selectedIds above; whatever's
        // left selected is exactly what got skipped, still visibly blocked.
        setError(`${result.skipped} task${result.skipped === 1 ? " was" : "s were"} skipped — still blocked.`);
      } else {
        clear();
      }
    });
  }

  return (
    <>
      <ul className="space-y-2 pb-20">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} selected={selected.has(task.id)} onToggleSelect={() => toggle(task.id)} />
        ))}
      </ul>
      <SelectionBar
        count={selectedIds.length}
        pending={isPending}
        error={error}
        onClear={clear}
        actions={
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-mute">Reassign to</span>
              <AssigneePicker employees={employees} value={null} disabled={isPending} onChange={handleReassign} />
            </div>
            <button
              type="button"
              onClick={() => setConfirmCloseOpen(true)}
              disabled={isPending}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-line disabled:cursor-not-allowed disabled:text-ink-mute"
            >
              Close
            </button>
          </>
        }
      />
      <ConfirmModal
        open={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={handleClose}
        title="Close selected tasks?"
        message={`Close ${selectedIds.length} selected task${selectedIds.length === 1 ? "" : "s"}?`}
        tone="default"
        confirmLabel="Close tasks"
        pending={isPending}
      />
    </>
  );
}
