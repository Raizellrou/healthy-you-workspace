"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { addSubtask, toggleSubtask, deleteSubtask } from "@/app/(app)/tasks/actions";
import { useActionToast } from "@/lib/toast-context";
import type { Subtask } from "@/types/task";

export function SubtaskChecklist({
  taskId,
  projectId,
  subtasks,
}: {
  taskId: string;
  projectId: string;
  subtasks: Subtask[];
}) {
  const [items, setItems] = useState(subtasks);
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();

  function handleToggle(subtaskId: string) {
    setItems((cur) => cur.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)));
    startTransition(async () => {
      await run(() => toggleSubtask(subtaskId, taskId, projectId), {
        // Revert the optimistic flip — without this the checkbox stayed
        // toggled even when the write failed, silently diverging from what
        // the server actually has.
        onError: () => setItems((cur) => cur.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s))),
      });
    });
  }

  function handleDelete(subtaskId: string) {
    const removed = items.find((s) => s.id === subtaskId);
    const removedIndex = items.findIndex((s) => s.id === subtaskId);
    setItems((cur) => cur.filter((s) => s.id !== subtaskId));
    startTransition(async () => {
      await run(() => deleteSubtask(subtaskId, taskId, projectId), {
        // A failed delete previously left the row gone from the UI but
        // present in the database until reload — put it back where it was.
        onError: () => {
          if (!removed) return;
          setItems((cur) => {
            const next = [...cur];
            next.splice(removedIndex, 0, removed);
            return next;
          });
        },
      });
    });
  }

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    startTransition(async () => {
      const result = await run(() => addSubtask(taskId, projectId, title), {
        // Give the typed text back — it never made it to the list, so
        // losing it too on top of the failure is needless extra typing.
        onError: () => setNewTitle(title),
      });
      if (result.ok && result.id) {
        setItems((cur) => [
          ...cur,
          { id: result.id as string, task_id: taskId, title, done: false, position: cur.length },
        ]);
      }
    });
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-mute">
        <span>Subtasks</span>
        {items.length > 0 ? (
          <span>
            {doneCount}/{items.length}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={s.done}
              aria-label={s.done ? "Mark subtask not done" : "Mark subtask done"}
              onClick={() => handleToggle(s.id)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                s.done ? "border-success bg-success" : "border-line hover:border-brand"
              }`}
            >
              {s.done ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </button>
            <span className={`flex-1 text-sm ${s.done ? "text-ink-mute line-through" : "text-ink"}`}>
              {s.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              className="text-ink-mute hover:text-risk-critical"
              aria-label="Delete subtask"
            >
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a subtask…"
          disabled={isPending}
          className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
        />
        <Button type="button" size="sm" variant="secondary" onClick={handleAdd} disabled={isPending || !newTitle.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
