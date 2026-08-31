"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, describeDbError, type ActionResult } from "@/lib/action-result";
import { revalidateProjectViews } from "./shared";

export async function createSection(projectId: string, name: string): Promise<ActionResult & { id?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Section name can't be empty.");

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
    return fail(describeDbError(error));
  }

  revalidateProjectViews(projectId);
  return ok({ id: data.id as string });
}

export async function renameSection(sectionId: string, projectId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return fail("Section name can't be empty.");

  const supabase = await createClient();
  const { error } = await supabase.from("board_sections").update({ name: trimmed }).eq("id", sectionId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateProjectViews(projectId);
  return ok();
}

export async function deleteSection(sectionId: string, projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("board_sections").delete().eq("id", sectionId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidateProjectViews(projectId);
  revalidatePath("/tasks");
  return ok();
}
