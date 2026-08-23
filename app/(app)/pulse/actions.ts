"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const SubmitSchema = z.object({
  questionId: z.uuid(),
  score: z.number().int().min(1).max(5),
});

/**
 * Records one anonymous pulse answer.
 *
 * The employee_id is written — it has to be, or the unique constraint that
 * stops double-answering has nothing to key on — but 0023 grants no SELECT
 * policy on pulse_responses to anyone, so the row is write-only from the
 * app's perspective. The system can tell THAT you answered; nobody, at any
 * role, can read WHAT you answered except through the n>=3 aggregate.
 *
 * A duplicate answer is reported plainly rather than silently overwritten:
 * an edit path would need an UPDATE policy, and adding one would give the
 * table a read-modify-write surface that the anonymity argument above
 * depends on not existing.
 */
export async function submitPulse(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(SubmitSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase.from("pulse_responses").insert({
        question_id: data.questionId,
        employee_id: employeeId,
        score: data.score,
      });
      if (error) {
        return fail(describeDbError(error, { "23505": "You've already answered this week's question." }));
      }
      revalidatePath("/pulse");
      return ok();
    })
  );
}
