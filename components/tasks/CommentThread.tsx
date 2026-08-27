"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { addComment } from "@/app/(app)/tasks/actions";
import { useActionToast } from "@/lib/toast-context";
import type { TaskComment } from "@/types/task";

export function CommentThread({
  taskId,
  projectId,
  comments,
  currentEmployeeName,
  currentEmployeeAvatarColor,
}: {
  taskId: string;
  projectId: string;
  comments: TaskComment[];
  currentEmployeeName?: string;
  currentEmployeeAvatarColor?: string;
}) {
  const [items, setItems] = useState(comments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const run = useActionToast();

  function handleAdd() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    startTransition(async () => {
      const result = await run(() => addComment(taskId, projectId, trimmed));
      if (result.ok) {
        setItems((cur) => [
          ...cur,
          {
            id: result.id ?? crypto.randomUUID(),
            task_id: taskId,
            author_id: "",
            body: trimmed,
            created_at: new Date().toISOString(),
            author_name: currentEmployeeName,
            author_avatar_color: currentEmployeeAvatarColor,
          },
        ]);
      }
    });
  }

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-mute">Comments</div>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.author_name ?? "?"} color={c.author_avatar_color ?? "#64748b"} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink">{c.author_name ?? "Unknown"}</span>
                <span className="text-xs text-ink-mute">
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          disabled={isPending}
          className="flex-1 resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink disabled:opacity-60"
        />
        <Button type="button" size="sm" variant="secondary" onClick={handleAdd} disabled={isPending || !body.trim()}>
          Post
        </Button>
      </div>
    </div>
  );
}
