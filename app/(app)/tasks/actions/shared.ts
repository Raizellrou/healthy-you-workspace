import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/supabase/people";
import { isOffHoursMoment } from "@/lib/tasks";
import { enqueue } from "@/lib/notify";
import type { TaskEventKind } from "@/types/task";

/**
 * Internal helpers shared across the tasks/actions/* Server Action files.
 * Deliberately has NO "use server" directive — these aren't meant to be
 * their own callable actions (recordEvent takes a live Supabase client,
 * which isn't serializable across a Server Action boundary anyway), just
 * plain server-only code the action files import and call directly.
 */

/** Best-effort task-assignment notification, skipped when you assign a
 *  task to yourself — nobody needs to be told they did their own thing. */
export async function notifyAssignee(taskId: string, taskTitle: string, assigneeId: string, actorId: string) {
  if (assigneeId === actorId) return;
  await enqueue({
    recipientId: assigneeId,
    actorId,
    kind: "task_assigned",
    title: `You were assigned "${taskTitle}"`,
    link: `/tasks/${taskId}`,
    entityType: "task",
    entityId: taskId,
  });
}

// P5 split one board route into four (/tasks/project/[projectId]/[view]),
// so a single revalidatePath("/tasks/board/...") no longer reaches whichever
// view the caller is actually looking at. revalidatePath needs an exact
// path per call (no wildcard segment), so this just lists the four.
export function revalidateProjectViews(projectId: string) {
  for (const view of ["list", "board", "calendar", "timeline"]) {
    revalidatePath(`/tasks/project/${projectId}/${view}`);
  }
}

export function revalidateTask(taskId: string, projectId: string) {
  revalidatePath("/tasks");
  revalidateProjectViews(projectId);
  revalidatePath(`/tasks/${taskId}`);
}

/** Revalidates every distinct project touched by a bulk op, plus the
 *  cross-project surfaces (My Tasks, Workload). Bulk actions are callable
 *  from My Tasks — which spans every project the caller has tasks in, not
 *  one board — so there's no single projectId to trust from the caller;
 *  the affected set is whatever the fetched rows actually say. */
export function revalidateBulk(projectIds: Iterable<string>) {
  revalidatePath("/tasks");
  revalidatePath("/tasks/workload");
  for (const projectId of new Set(projectIds)) revalidateProjectViews(projectId);
}

/**
 * Writes one row to the append-only task_events log (0011_task_engine.sql).
 * Best-effort by design: a failed or skipped event write (no signed-in
 * person — shouldn't happen behind an authenticated action, but this is
 * cheaper than threading a second failure mode through every caller) never
 * fails the primary mutation it's describing. `is_off_hours` uses the
 * actor's own timezone (P2's employees.timezone), not a fixed zone.
 */
export async function recordEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string | null,
  kind: TaskEventKind,
  values: { from?: string | null; to?: string | null } = {}
): Promise<void> {
  const person = await getCurrentPerson();
  if (!person) return;
  await supabase.from("task_events").insert({
    task_id: taskId,
    actor_id: person.id,
    kind,
    from_value: values.from ?? null,
    to_value: values.to ?? null,
    is_off_hours: isOffHoursMoment(new Date(), person.timezone),
  });
}
