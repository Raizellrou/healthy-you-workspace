"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const SaveTaskViewSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1, "Name can't be empty.").max(60, "Name is too long."),
  layout: z.enum(["list", "board", "calendar", "timeline"]),
  filters: z.record(z.string(), z.string()),
  isShared: z.boolean().optional(),
});

/** Filter state lives in the URL, so "saving a view" just names a
 *  querystring — loading one is a plain navigation, not a state restore. */
export async function saveTaskView(input: unknown): Promise<ActionResult & { id?: string }> {
  return withEmployee((employeeId) =>
    validated(SaveTaskViewSchema, input, async (data) => {
      const supabase = await createClient();
      const { data: view, error } = await supabase
        .from("task_views")
        .insert({
          owner_id: employeeId,
          project_id: data.projectId,
          name: data.name,
          layout: data.layout,
          filters: data.filters,
          is_shared: data.isShared ?? false,
        })
        .select("id")
        .single();
      if (error) {
        return fail(describeDbError(error));
      }
      revalidatePath(`/tasks/project/${data.projectId}/${data.layout}`);
      return ok({ id: view.id as string });
    })
  );
}

export async function deleteTaskView(viewId: string, projectId: string, layout: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("task_views").delete().eq("id", viewId);
  if (error) {
    return fail(describeDbError(error));
  }
  revalidatePath(`/tasks/project/${projectId}/${layout}`);
  return ok();
}
