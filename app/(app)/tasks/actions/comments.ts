"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import { enqueue, buildMentionLookup, parseMentions } from "@/lib/notify";
import { ok, fail, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";
import { recordEvent, revalidateTask } from "./shared";

export async function addComment(
  taskId: string,
  projectId: string,
  body: string
): Promise<ActionResult & { id?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return fail("Comment can't be empty.");

  return withEmployee(async (authorId) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, author_id: authorId, body: trimmed })
      .select("id")
      .single();
    if (error) {
      return fail(describeDbError(error));
    }

    await recordEvent(supabase, taskId, "commented", { to: trimmed.slice(0, 200) });

    const [employees, task] = await Promise.all([
      getEmployees(),
      supabase.from("tasks").select("title").eq("id", taskId).single(),
    ]);
    const mentionedIds = parseMentions(trimmed, buildMentionLookup(employees)).filter((id) => id !== authorId);
    if (mentionedIds.length > 0) {
      await supabase
        .from("mentions")
        .insert(mentionedIds.map((mentioned_employee_id) => ({ comment_id: data.id, mentioned_employee_id })));
      const taskTitle = task.data?.title ?? "a task";
      await Promise.all(
        mentionedIds.map((recipientId) =>
          enqueue({
            recipientId,
            actorId: authorId,
            kind: "mention",
            title: `You were mentioned on "${taskTitle}"`,
            body: trimmed.slice(0, 200),
            link: `/tasks/${taskId}`,
            entityType: "task_comment",
            entityId: data.id as string,
          })
        )
      );
    }

    revalidateTask(taskId, projectId);
    return ok({ id: data.id as string });
  });
}
