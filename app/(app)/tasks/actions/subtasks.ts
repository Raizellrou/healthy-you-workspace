"use server";

import { createClient } from "@/lib/supabase/server";
import { ok, fail, describeDbError, type ActionResult } from "@/lib/action-result";
import { revalidateTask } from "./shared";

export async function addSubtask(
  taskId: string,
  projectId: string,
  title: string
): Promise<ActionResult & { id?: string }> {
  const trimmed = title.trim();
  if (!trimmed) return fail("Subtask title can't be empty.");

  const supabase = await createClient();
  const { count } = await supabase
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);

  const { data, error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title: trimmed, position: count ?? 0 })
    .select("id")
    .single();
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateTask(taskId, projectId);
  return ok({ id: data.id as string });
}

export async function toggleSubtask(
  subtaskId: string,
  taskId: string,
  projectId: string
): Promise<ActionResult & { done?: boolean }> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("subtasks")
    .select("done")
    .eq("id", subtaskId)
    .single();
  if (fetchError || !current) {
    return fail(fetchError?.message ?? "Subtask not found.");
  }

  const nextDone = !current.done;
  const { error } = await supabase.from("subtasks").update({ done: nextDone }).eq("id", subtaskId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateTask(taskId, projectId);
  return ok({ done: nextDone });
}

export async function deleteSubtask(
  subtaskId: string,
  taskId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateTask(taskId, projectId);
  return ok();
}
