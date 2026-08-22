import { Avatar } from "@/components/ui/Avatar";
import type { TaskEvent } from "@/types/task";

const KIND_LABEL: Record<TaskEvent["kind"], string> = {
  created: "created this task",
  completed: "marked this task done",
  reopened: "reopened this task",
  assigned: "reassigned this task",
  unassigned: "unassigned this task",
  moved: "moved this task",
  commented: "commented",
  due_changed: "changed the due date",
  priority_changed: "changed the priority",
  estimate_changed: "changed the estimate",
  deleted: "deleted this task",
};

/** Renders task_events (0011_task_engine.sql) as an activity feed — the
 *  append-only log every mutating action in actions.ts writes to. */
export function TaskActivity({ events }: { events: TaskEvent[] }) {
  if (events.length === 0) {
    return <p className="text-xs text-ink-mute">No activity yet.</p>;
  }

  return (
    <ul className="space-y-2.5">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2.5 text-sm">
          <Avatar name={e.actor_name ?? "?"} color={e.actor_avatar_color ?? "#64748b"} size={22} />
          <div className="min-w-0 flex-1">
            <p className="text-ink-soft">
              <span className="font-medium text-ink">{e.actor_name ?? "Someone"}</span> {KIND_LABEL[e.kind]}
              {e.is_off_hours ? <span className="ml-1.5 text-xs text-risk-critical">· off hours</span> : null}
            </p>
            <p className="text-xs text-ink-mute">
              {new Date(e.created_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
