"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { todayInTz } from "@/lib/date";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

export interface SubmitMoodResult {
  ok: boolean;
  error?: string;
}

export async function submitMoodCheckin(
  moodValue: 1 | 2 | 3 | 4 | 5
): Promise<SubmitMoodResult> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return { ok: false, error: "Not signed in." };
  }

  const supabase = await createClient();
  // The employee's own local date, not the server's UTC date or the org
  // default — an evening check-in in a positive-offset zone was landing on
  // tomorrow and tripping the (employee_id, date) unique constraint a day
  // early. Real per-employee timezones (0009) make this exact now.
  const person = await getCurrentPerson();
  const today = todayInTz(person?.timezone);

  const { error } = await supabase.from("mood_checkins").insert({
    employee_id: employeeId,
    date: today,
    mood_value: moodValue,
  });

  if (error) {
    // unique_violation — already checked in today
    if (error.code === "23505") {
      return { ok: false, error: "You already checked in today." };
    }
    return { ok: false, error: describeDbError(error) };
  }

  revalidatePath("/mood");
  return { ok: true };
}

const UpdateMoodDetailsSchema = z.object({
  moodValue: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  energy: z.number().int().min(1).max(5).nullable(),
  note: z.string().trim().max(2000).nullable(),
  tags: z.array(z.string()).default([]),
});

/** Optional add-on to a check-in that already happened — kept as a
 *  separate, opt-in step rather than folded into submitMoodCheckin so the
 *  default flow (pick a mood, done) stays the single click the pillar's
 *  own "frictionless" promise describes.
 *
 *  `moodValue` doubles this as the same-day mood-correction path: an UPDATE
 *  against today's existing row, scoped to this employee, rather than a
 *  second INSERT that would trip the (employee_id, date) unique constraint. */
export async function updateMoodDetails(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(UpdateMoodDetailsSchema, input, async (data) => {
      const supabase = await createClient();
      const person = await getCurrentPerson();
      const today = todayInTz(person?.timezone);

      const { data: updated, error } = await supabase
        .from("mood_checkins")
        .update({
          ...(data.moodValue !== undefined ? { mood_value: data.moodValue } : {}),
          energy: data.energy,
          note: data.note || null,
          tags: data.tags,
        })
        .eq("employee_id", employeeId)
        .eq("date", today)
        .select("id")
        .maybeSingle();
      if (error) {
        return fail(describeDbError(error));
      }
      // RLS filters rather than throws — a zero-row match on employee_id +
      // date is exactly the silent no-op class that hit before 0017's
      // UPDATE policy existed, so confirm a row actually matched.
      if (!updated) {
        return fail("No check-in found for today to update.");
      }
      revalidatePath("/mood");
      return ok();
    })
  );
}
