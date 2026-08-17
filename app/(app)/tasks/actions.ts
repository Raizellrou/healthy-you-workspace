"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import type { Task } from "@/types/task";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateTask(taskId: string, projectId: string) {
  revalidatePath("/tasks");
  revalidatePath(`/tasks/board/${projectId}`);
  revalidatePath(`/tasks/${taskId}`);
}

export async function toggleDone(
  taskId: string,
  projectId: string
): Promise<ActionResult & { done?: boolean }> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("tasks")
    .select("done")
    .eq("id", taskId)
    .single();
  if (fetchError || !current) {
    return { ok: false, error: fetchError?.message ?? "Task not found." };
  }

  const nextDone = !current.done;
  const { error } = await supabase.from("tasks").update({ done: nextDone }).eq("id", taskId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true, done: nextDone };
}

export async function updateTask(
  taskId: string,
  projectId: string,
  updates: Partial<Pick<Task, "title" | "description" | "assignee_id" | "priority" | "due_date">>
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true };
}

export async function addSubtask(
  taskId: string,
  projectId: string,
  title: string
): Promise<ActionResult & { id?: string }> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Subtask title can't be empty." };

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
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true, id: data.id as string };
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
    return { ok: false, error: fetchError?.message ?? "Subtask not found." };
  }

  const nextDone = !current.done;
  const { error } = await supabase.from("subtasks").update({ done: nextDone }).eq("id", subtaskId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true, done: nextDone };
}

export async function deleteSubtask(
  subtaskId: string,
  taskId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("subtasks").delete().eq("id", subtaskId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true };
}

// Moves `taskId` into `targetSectionId` (or leaves it in its current
// section) and rewrites positions for every task in the target section to
// match `orderedTaskIds` — the full, post-move ordering the board computed
// client-side. Sequential integer positions, same approach as
// lib/tasks.ts#reindexPositions; correct at this project's scale.
export async function moveTask(
  taskId: string,
  projectId: string,
  targetSectionId: string | null,
  orderedTaskIds: string[]
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: moveError } = await supabase
    .from("tasks")
    .update({ section_id: targetSectionId })
    .eq("id", taskId);
  if (moveError) {
    return { ok: false, error: moveError.message };
  }

  const results = await Promise.all(
    orderedTaskIds.map((id, position) => supabase.from("tasks").update({ position }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: failed.error.message };
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/board/${projectId}`);
  return { ok: true };
}

const DEFAULT_SECTIONS = ["To do", "In progress", "Done"];

export async function createProject(name: string, color: string): Promise<ActionResult & { id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Project name can't be empty." };

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name: trimmed, color })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: sectionError } = await supabase
    .from("board_sections")
    .insert(DEFAULT_SECTIONS.map((sectionName, position) => ({ project_id: project.id, name: sectionName, position })));
  if (sectionError) {
    return { ok: false, error: sectionError.message };
  }

  revalidatePath("/tasks");
  return { ok: true, id: project.id as string };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/tasks");
  return { ok: true };
}

export async function createSection(projectId: string, name: string): Promise<ActionResult & { id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Section name can't be empty." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("board_sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data, error } = await supabase
    .from("board_sections")
    .insert({ project_id: projectId, name: trimmed, position: count ?? 0 })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/tasks/board/${projectId}`);
  return { ok: true, id: data.id as string };
}

export async function renameSection(sectionId: string, projectId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Section name can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("board_sections").update({ name: trimmed }).eq("id", sectionId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/tasks/board/${projectId}`);
  return { ok: true };
}

export async function deleteSection(sectionId: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("board_sections").delete().eq("id", sectionId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/tasks/board/${projectId}`);
  revalidatePath("/tasks");
  return { ok: true };
}

export async function addComment(
  taskId: string,
  projectId: string,
  body: string
): Promise<ActionResult & { id?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Comment can't be empty." };

  const authorId = await getCurrentEmployeeId();
  if (!authorId) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: authorId, body: trimmed })
    .select("id")
    .single();
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidateTask(taskId, projectId);
  return { ok: true, id: data.id as string };
}
