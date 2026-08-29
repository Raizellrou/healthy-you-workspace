"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/supabase/people";
import { canManageProjects, isManagerOrHr } from "@/lib/authz";
import { enqueue } from "@/lib/notify";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";
import { notifyAssignee, revalidateProjectViews, revalidateTask, revalidateBulk, recordEvent } from "./shared";
import type { Task } from "@/types/task";

export async function toggleDone(
  taskId: string,
  projectId: string
): Promise<ActionResult & { done?: boolean }> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("tasks")
    .select("done, blocked_by")
    .eq("id", taskId)
    .single();
  if (fetchError || !current) {
    return fail(fetchError?.message ?? "Task not found.");
  }

  const nextDone = !current.done;

  // The UI disables the done toggle while blocked, but that's advisory —
  // this is the actual gate. Re-checked here rather than trusted from the
  // client because a Server Action is a public HTTP surface.
  if (nextDone && current.blocked_by) {
    const { data: blocker } = await supabase.from("tasks").select("title, done").eq("id", current.blocked_by).single();
    if (blocker && !blocker.done) {
      return fail(`Blocked by "${blocker.title}" — that task isn't done yet.`);
    }
  }

  const { error } = await supabase.from("tasks").update({ done: nextDone }).eq("id", taskId);
  if (error) {
    return fail(describeDbError(error));
  }

  await recordEvent(supabase, taskId, nextDone ? "completed" : "reopened");
  revalidateTask(taskId, projectId);
  return ok({ done: nextDone });
}

export async function updateTask(
  taskId: string,
  projectId: string,
  updates: Partial<
    Pick<Task, "title" | "description" | "assignee_id" | "priority" | "due_date" | "start_date" | "estimate_hours">
  >
): Promise<ActionResult> {
  const supabase = await createClient();

  // Fetched before the write so the diff below can tell what actually
  // changed — updated_at itself no longer needs setting here, the
  // tasks_touch_updated_at_trigger (0011) handles every write path now,
  // not just this one.
  const { data: current } = await supabase
    .from("tasks")
    .select("assignee_id, priority, due_date, estimate_hours")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
  if (error) {
    return fail(describeDbError(error));
  }

  if (current) {
    if ("assignee_id" in updates && updates.assignee_id !== current.assignee_id) {
      await recordEvent(supabase, taskId, updates.assignee_id ? "assigned" : "unassigned", {
        from: current.assignee_id,
        to: updates.assignee_id ?? null,
      });
      if (updates.assignee_id) {
        const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).single();
        const person = await getCurrentPerson();
        if (task && person) {
          await notifyAssignee(taskId, task.title, updates.assignee_id, person.id);
        }
      }
    }
    if ("priority" in updates && updates.priority !== current.priority) {
      await recordEvent(supabase, taskId, "priority_changed", {
        from: current.priority,
        to: updates.priority ?? null,
      });
    }
    if ("due_date" in updates && updates.due_date !== current.due_date) {
      await recordEvent(supabase, taskId, "due_changed", { from: current.due_date, to: updates.due_date ?? null });
    }
    if ("estimate_hours" in updates && updates.estimate_hours !== current.estimate_hours) {
      await recordEvent(supabase, taskId, "estimate_changed", {
        from: current.estimate_hours != null ? String(current.estimate_hours) : null,
        to: updates.estimate_hours != null ? String(updates.estimate_hours) : null,
      });
    }
  }

  revalidateTask(taskId, projectId);
  return ok();
}

const CreateTaskSchema = z.object({
  projectId: z.uuid(),
  sectionId: z.uuid().nullable(),
  title: z.string().trim().min(1, "Title can't be empty.").max(200, "Title is too long."),
  description: z.string().trim().max(5000, "Description is too long.").optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  estimateHours: z.number().min(0).max(500).nullable().optional(),
  labelIds: z.array(z.uuid()).optional(),
});

/**
 * There was no way to create a task anywhere in the app before this — every
 * task in the database came from scripts/seed-tasks.ts. This is that path.
 */
export async function createTask(input: unknown): Promise<ActionResult & { id?: string }> {
  return withEmployee((employeeId) =>
    validated(CreateTaskSchema, input, async (data) => {
      const supabase = await createClient();

      let positionQuery = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", data.projectId);
      positionQuery = data.sectionId
        ? positionQuery.eq("section_id", data.sectionId)
        : positionQuery.is("section_id", null);
      const { count } = await positionQuery;

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          project_id: data.projectId,
          section_id: data.sectionId,
          title: data.title,
          description: data.description || null,
          assignee_id: data.assigneeId ?? null,
          created_by: employeeId,
          priority: data.priority,
          due_date: data.dueDate || null,
          start_date: data.startDate || null,
          estimate_hours: data.estimateHours ?? null,
          position: count ?? 0,
        })
        .select("id")
        .single();
      if (error) {
        return fail(describeDbError(error));
      }

      if (data.labelIds?.length) {
        const { error: labelError } = await supabase
          .from("task_labels")
          .insert(data.labelIds.map((label_id) => ({ task_id: task.id, label_id })));
        if (labelError) {
          return fail(describeDbError(labelError));
        }
      }

      await recordEvent(supabase, task.id as string, "created");
      if (data.assigneeId) {
        await notifyAssignee(task.id as string, data.title, data.assigneeId, employeeId);
      }

      revalidatePath("/tasks");
      revalidateProjectViews(data.projectId);
      revalidatePath("/tasks/workload");
      return ok({ id: task.id as string });
    })
  );
}

/**
 * Deletes a task. Self-checks the caller's role rather than relying on RLS —
 * 0007_tasks_rls.sql's "tasks deletable by authenticated" policy is wide
 * open, so this is the only gate (see canManageProjects in lib/authz.ts).
 */
export async function deleteTask(taskId: string, projectId: string): Promise<ActionResult> {
  const person = await getCurrentPerson();
  if (!person || !canManageProjects(person.appRole)) {
    return fail("Only managers and HR can do that.");
  }

  const supabase = await createClient();

  // Recorded before the delete: task_events.task_id is ON DELETE SET NULL
  // (0011), not CASCADE, specifically so this row — and every earlier event
  // for this task — survives the task's own deletion instead of vanishing
  // with it.
  const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).maybeSingle();
  await recordEvent(supabase, taskId, "deleted", { to: task?.title ?? undefined });

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidatePath("/tasks");
  revalidateProjectViews(projectId);
  revalidatePath("/tasks/workload");
  return ok();
}

export async function setLabels(taskId: string, projectId: string, labelIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: delError } = await supabase.from("task_labels").delete().eq("task_id", taskId);
  if (delError) {
    return fail(describeDbError(delError));
  }
  if (labelIds.length) {
    const { error: insError } = await supabase
      .from("task_labels")
      .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })));
    if (insError) {
      return fail(describeDbError(insError));
    }
  }

  revalidateTask(taskId, projectId);
  return ok();
}

export async function duplicateTask(taskId: string, projectId: string): Promise<ActionResult & { id?: string }> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();

    const { data: source, error: fetchError } = await supabase
      .from("tasks")
      .select(
        "project_id, section_id, title, description, assignee_id, priority, due_date, start_date, estimate_hours, position"
      )
      .eq("id", taskId)
      .single();
    if (fetchError || !source) {
      return fail(fetchError?.message ?? "Task not found.");
    }

    const { data: copy, error } = await supabase
      .from("tasks")
      .insert({
        project_id: source.project_id,
        section_id: source.section_id,
        title: `${source.title} (copy)`,
        description: source.description,
        assignee_id: source.assignee_id,
        created_by: employeeId,
        priority: source.priority,
        due_date: source.due_date,
        start_date: source.start_date,
        estimate_hours: source.estimate_hours,
        position: source.position + 1,
      })
      .select("id")
      .single();
    if (error) {
      return fail(describeDbError(error));
    }

    await recordEvent(supabase, copy.id as string, "created", { from: taskId });

    revalidatePath("/tasks");
    revalidateProjectViews(projectId);
    revalidatePath("/tasks/workload");
    return ok({ id: copy.id as string });
  });
}

/** Reassigns a batch of tasks in one call — the primitive the P8 workload
 *  rebalancer builds on, but useful on its own from day one. */
export async function bulkReassign(taskIds: string[], assigneeId: string | null): Promise<ActionResult> {
  if (taskIds.length === 0) return ok();
  const supabase = await createClient();

  const { data: current } = await supabase.from("tasks").select("id, project_id, title, assignee_id").in("id", taskIds);
  const rows = current ?? [];

  const { error } = await supabase.from("tasks").update({ assignee_id: assigneeId }).in("id", taskIds);
  if (error) {
    return fail(describeDbError(error));
  }

  const person = assigneeId ? await getCurrentPerson() : null;
  for (const row of rows) {
    if (row.assignee_id !== assigneeId) {
      await recordEvent(supabase, row.id, assigneeId ? "assigned" : "unassigned", {
        from: row.assignee_id,
        to: assigneeId,
      });
      if (assigneeId && person) {
        await notifyAssignee(row.id, row.title, assigneeId, person.id);
      }
    }
  }

  revalidateBulk(rows.map((r) => r.project_id));
  return ok();
}

/** Closes a batch of tasks in one call — bulkReassign's sibling primitive.
 *  A task whose blocker isn't done yet is silently skipped rather than
 *  failing the whole batch: the same rule toggleDone enforces one at a
 *  time, applied here so bulk-close can't be used to route around it. */
export async function bulkClose(taskIds: string[]): Promise<ActionResult & { skipped?: number }> {
  if (taskIds.length === 0) return ok();
  const supabase = await createClient();

  const { data: currentRes } = await supabase.from("tasks").select("id, project_id, done, blocked_by").in("id", taskIds);
  const rows = currentRes ?? [];

  const blockerIds = Array.from(new Set(rows.map((r) => r.blocked_by).filter((id): id is string => id !== null)));
  const blockerDoneById = new Map<string, boolean>();
  if (blockerIds.length > 0) {
    const { data: blockers } = await supabase.from("tasks").select("id, done").in("id", blockerIds);
    for (const b of blockers ?? []) blockerDoneById.set(b.id, b.done);
  }

  const closable = rows.filter((r) => !r.done && (!r.blocked_by || blockerDoneById.get(r.blocked_by) !== false));
  const closableIds = closable.map((r) => r.id);
  const skipped = rows.length - closableIds.length;

  if (closableIds.length === 0) return ok({ skipped });

  const { error } = await supabase.from("tasks").update({ done: true }).in("id", closableIds);
  if (error) {
    return fail(describeDbError(error));
  }

  for (const id of closableIds) {
    await recordEvent(supabase, id, "completed");
  }

  revalidateBulk(closable.map((r) => r.project_id));
  return ok({ skipped });
}

/** Sets or clears a task's single blocker (tasks.blocked_by, 0011) — the
 *  column has existed since P3 with no writer until now. One blocker per
 *  task by design, not a dependency graph: rejects self-blocking and the
 *  direct A-blocks-B-blocks-A case, but doesn't walk a longer chain. */
export async function setBlockedBy(
  taskId: string,
  projectId: string,
  blockerId: string | null
): Promise<ActionResult> {
  const supabase = await createClient();

  if (blockerId) {
    if (blockerId === taskId) {
      return fail("A task can't block itself.");
    }
    const { data: blocker, error: blockerError } = await supabase
      .from("tasks")
      .select("id, project_id, blocked_by")
      .eq("id", blockerId)
      .single();
    if (blockerError || !blocker) {
      return fail("That task couldn't be found.");
    }
    if (blocker.project_id !== projectId) {
      return fail("A blocker must be in the same project.");
    }
    if (blocker.blocked_by === taskId) {
      return fail("That would create a cycle — it's already blocked by this task.");
    }
  }

  const { error } = await supabase.from("tasks").update({ blocked_by: blockerId }).eq("id", taskId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateProjectViews(projectId);
  revalidatePath(`/tasks/${taskId}`);
  return ok();
}

const RebalanceMoveSchema = z.object({
  taskId: z.uuid(),
  fromEmployeeId: z.uuid(),
  toEmployeeId: z.uuid(),
});
const ApplyRebalanceSchema = z.object({ moves: z.array(RebalanceMoveSchema).min(1).max(10) });

/**
 * Applies lib/rebalance.ts#suggestRebalanceMoves' suggestions. Restricted to
 * managers/HR at the app level, not RLS — tasks stay org-writable per
 * 0007_tasks_rls.sql's "it's a shared work tool" reasoning, so this is the
 * one write path in this file that adds its own role check rather than
 * relying on the table policy.
 *
 * Each move is re-verified against the task's *current* assignee before
 * writing: the suggestion list was computed moments earlier from a snapshot,
 * and if that task has since moved (someone else reassigned it, or an
 * earlier move in this same batch already touched it) the stale suggestion
 * is silently skipped rather than clobbering an unrelated change.
 *
 * Notifies both sides — unlike bulkReassign's notifyAssignee, the person
 * losing a task here needs to know why it disappeared, so this uses the
 * dedicated 'task_reassigned' kind (0018) instead of 'task_assigned'.
 */
export async function applyRebalanceMoves(input: unknown): Promise<ActionResult> {
  return withEmployee((actorId) =>
    validated(ApplyRebalanceSchema, input, async ({ moves }) => {
      const person = await getCurrentPerson();
      if (!person || !isManagerOrHr(person.appRole)) {
        return fail("Only managers or HR can apply a workload rebalance.");
      }

      const supabase = await createClient();
      const projectIds = new Set<string>();
      let applied = 0;

      for (const move of moves) {
        const { data: task } = await supabase
          .from("tasks")
          .select("id, title, assignee_id, project_id")
          .eq("id", move.taskId)
          .maybeSingle();
        if (!task || task.assignee_id !== move.fromEmployeeId) continue;

        const { error } = await supabase
          .from("tasks")
          .update({ assignee_id: move.toEmployeeId })
          .eq("id", move.taskId);
        if (error) continue;

        await recordEvent(supabase, move.taskId, "assigned", {
          from: move.fromEmployeeId,
          to: move.toEmployeeId,
        });
        await enqueue({
          recipientId: move.toEmployeeId,
          actorId,
          kind: "task_reassigned",
          title: `"${task.title}" was moved to you to balance workload`,
          link: `/tasks/${move.taskId}`,
          entityType: "task",
          entityId: move.taskId,
        });
        await enqueue({
          recipientId: move.fromEmployeeId,
          actorId,
          kind: "task_reassigned",
          title: `"${task.title}" was moved off your plate to balance workload`,
          link: `/tasks/${move.taskId}`,
          entityType: "task",
          entityId: move.taskId,
        });

        projectIds.add(task.project_id as string);
        applied++;
      }

      if (applied === 0) return fail("Those suggestions are no longer current — refresh and try again.");

      revalidatePath("/tasks");
      revalidatePath("/tasks/workload");
      for (const projectId of projectIds) revalidateProjectViews(projectId);
      return ok();
    })
  );
}

// Moves `taskId` into `targetSectionId` (or leaves it in its current
// section) and rewrites positions for every task in the target section to
// match `orderedTaskIds` — the full, post-move ordering the board computed
// client-side. Delegates to the reorder_section RPC (0011) so the whole
// column reindex is one statement instead of one UPDATE per task with no
// transactional guarantee between them.
export async function moveTask(
  taskId: string,
  projectId: string,
  targetSectionId: string | null,
  orderedTaskIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: current } = await supabase.from("tasks").select("section_id").eq("id", taskId).single();

  const { error } = await supabase.rpc("reorder_section", {
    p_section_id: targetSectionId,
    p_ordered_ids: orderedTaskIds,
  });
  if (error) {
    return fail(describeDbError(error));
  }

  if (current && current.section_id !== targetSectionId) {
    await recordEvent(supabase, taskId, "moved", { from: current.section_id, to: targetSectionId });
  }

  revalidatePath("/tasks");
  revalidateProjectViews(projectId);
  return ok();
}
