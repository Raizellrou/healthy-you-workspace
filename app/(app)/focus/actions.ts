"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const StartFocusSchema = z.object({
  mode: z.enum(["standard", "focus", "calm"]),
  trigger: z.enum(["manual", "auto_burnout", "auto_meeting_free"]),
});

/** Ends any already-open session for this employee first — the partial
 *  unique index (one open session per employee) would otherwise reject a
 *  second insert, and switching modes without an explicit "end" click is
 *  exactly the flow the mode buttons offer. */
export async function startFocusSession(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(StartFocusSchema, input, async (data) => {
      const supabase = await createClient();
      await supabase
        .from("focus_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("employee_id", employeeId)
        .is("ended_at", null);

      const { error } = await supabase.from("focus_sessions").insert({
        employee_id: employeeId,
        mode: data.mode,
        trigger: data.trigger,
      });
      if (error) {
        return fail(describeDbError(error));
      }
      revalidatePath("/focus");
      return ok();
    })
  );
}

/** Ends the employee's open session and releases every notification held
 *  for `held_reason = 'focus_session'` by setting deliver_after = now() —
 *  the explicit release the P6 architecture relies on instead of a
 *  precomputed time, since nobody knows in advance when a focus session
 *  will end. Runs as the recipient themself, so notifications' self-scoped
 *  UPDATE RLS (0014) allows this directly — no security definer needed. */
export async function endFocusSession(): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();

    const { data: openSession } = await supabase
      .from("focus_sessions")
      .select("id, started_at")
      .eq("employee_id", employeeId)
      .is("ended_at", null)
      .maybeSingle();
    if (!openSession) {
      return fail("No focus session is currently open.");
    }

    const endedAt = new Date().toISOString();
    const [{ count: tasksCompleted }, { count: notificationsSuppressed }] = await Promise.all([
      supabase
        .from("task_events")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", employeeId)
        .eq("kind", "completed")
        .gte("created_at", openSession.started_at)
        .lte("created_at", endedAt),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", employeeId)
        .eq("held_reason", "focus_session")
        .gte("created_at", openSession.started_at)
        .lte("created_at", endedAt),
    ]);

    const { error } = await supabase
      .from("focus_sessions")
      .update({
        ended_at: endedAt,
        tasks_completed: tasksCompleted ?? 0,
        notifications_suppressed: notificationsSuppressed ?? 0,
      })
      .eq("id", openSession.id);
    if (error) {
      return fail(describeDbError(error));
    }

    await supabase
      .from("notifications")
      .update({ deliver_after: endedAt, held_reason: null })
      .eq("recipient_id", employeeId)
      .eq("held_reason", "focus_session")
      .is("read_at", null);

    revalidatePath("/focus");
    revalidatePath("/inbox");
    return ok({ tasksCompleted: tasksCompleted ?? 0, notificationsSuppressed: notificationsSuppressed ?? 0 });
  });
}
