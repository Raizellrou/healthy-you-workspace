"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/supabase/people";
import { canManageProjects } from "@/lib/authz";
import { ok, fail, describeDbError, type ActionResult } from "@/lib/action-result";

const DEFAULT_SECTIONS = ["To do", "In progress", "Done"];

/**
 * Creates a project. Self-checks the caller's role rather than relying on
 * RLS — 0007_tasks_rls.sql's "projects modifiable by authenticated" policy
 * is wide open, so this is the only gate (see canManageProjects in
 * lib/authz.ts).
 */
export async function createProject(name: string, color: string): Promise<ActionResult & { id?: string }> {
  const person = await getCurrentPerson();
  if (!person || !canManageProjects(person.appRole)) {
    return fail("Only managers and HR can do that.");
  }

  const trimmed = name.trim();
  if (!trimmed) return fail("Project name can't be empty.");

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name: trimmed, color })
    .select("id")
    .single();
  if (error) {
    return fail(describeDbError(error));
  }

  const { error: sectionError } = await supabase
    .from("board_sections")
    .insert(DEFAULT_SECTIONS.map((sectionName, position) => ({ project_id: project.id, name: sectionName, position })));
  if (sectionError) {
    return fail(describeDbError(sectionError));
  }

  revalidatePath("/tasks");
  return ok({ id: project.id as string });
}

/**
 * Deletes a project. Self-checks the caller's role rather than relying on
 * RLS — 0007_tasks_rls.sql's "projects modifiable by authenticated" policy
 * is wide open, so this is the only gate (see canManageProjects in
 * lib/authz.ts).
 */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const person = await getCurrentPerson();
  if (!person || !canManageProjects(person.appRole)) {
    return fail("Only managers and HR can do that.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    return fail(describeDbError(error));
  }

  revalidatePath("/tasks");
  return ok();
}
