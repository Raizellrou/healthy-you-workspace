"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getReportAgendas } from "@/lib/supabase/one-on-ones";
import { enqueue } from "@/lib/notify";
import { fmtDate } from "@/lib/date";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const ScheduleSchema = z.object({
  employeeId: z.uuid(),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
});

/**
 * Schedules a 1:1 and freezes the current agenda onto the row.
 *
 * The agenda is snapshotted rather than recomputed on read so the record
 * reflects what was true when the meeting was booked — a score that drifts
 * between scheduling and the conversation shouldn't silently rewrite the
 * reason the conversation was called.
 *
 * Authorisation is 0021's INSERT policy (`manages(employee_id) or is_hr()`,
 * and manager_id must be the caller). This action doesn't re-check it;
 * getReportAgendas() offers exactly that same set, so a mismatch surfaces
 * as a Postgres error rather than a silent no-op.
 */
export async function scheduleOneOnOne(input: unknown): Promise<ActionResult> {
  return withEmployee((managerId) =>
    validated(ScheduleSchema, input, async (data) => {
      const me = await getCurrentPerson();
      if (!me) return fail("Not signed in.");

      const agendas = await getReportAgendas(me);
      const target = agendas.find((a) => a.person.id === data.employeeId);
      if (!target) return fail("You can't schedule a 1:1 with that person.");

      const supabase = await createClient();
      const { data: row, error } = await supabase
        .from("one_on_ones")
        .insert({
          manager_id: managerId,
          employee_id: data.employeeId,
          scheduled_for: data.scheduledFor,
          agenda: target.items,
        })
        .select("id")
        .single();
      if (error) return fail(describeDbError(error));

      await enqueue({
        recipientId: data.employeeId,
        actorId: managerId,
        kind: "one_on_one_scheduled",
        title: `${me.name} scheduled a 1:1 with you for ${fmtDate(data.scheduledFor)}`,
        body:
          target.items.length > 0
            ? `${target.items.length} ${target.items.length === 1 ? "topic" : "topics"} on the agenda — you can see all of it.`
            : "No agenda items flagged — a general check-in.",
        link: "/one-on-ones",
        entityType: "one_on_one",
        entityId: row.id as string,
      });

      revalidatePath("/one-on-ones");
      return ok({ id: row.id as string });
    })
  );
}

const CompleteSchema = z.object({
  id: z.uuid(),
  sharedNotes: z.string().max(5000).optional(),
});

/** Marks a 1:1 done, optionally with notes. Notes are shared by design —
 *  the subject can read every one of these rows (0021). */
export async function completeOneOnOne(input: unknown): Promise<ActionResult> {
  return withEmployee(() =>
    validated(CompleteSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase
        .from("one_on_ones")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          shared_notes: data.sharedNotes?.trim() || null,
        })
        .eq("id", data.id)
        .eq("status", "scheduled");
      if (error) return fail(describeDbError(error));

      revalidatePath("/one-on-ones");
      return ok();
    })
  );
}

export async function cancelOneOnOne(id: string): Promise<ActionResult> {
  return withEmployee(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("one_on_ones")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "scheduled");
    if (error) return fail(describeDbError(error));

    revalidatePath("/one-on-ones");
    return ok();
  });
}
