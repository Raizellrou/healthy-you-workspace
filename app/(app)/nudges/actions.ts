"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const RecordNudgeSchema = z.object({
  nudgeType: z.enum(["stretch", "hydrate", "eye_rest", "posture"]),
  result: z.enum(["sent", "suppressed", "done", "snoozed"]),
  reason: z.string().max(200).nullable(),
});

/** Persists one entry from the simulated nudge log (lib/nudge-context.tsx,
 *  frozen) to nudge_events — durable history for a simulation that was
 *  previously session-local and gone on refresh. This does not change what
 *  fires or when; the frozen context's own logic is untouched. Called from
 *  components/nudges/NudgePersistence.tsx, mounted once inside
 *  NudgeProvider so every log entry gets written regardless of which page
 *  is open. */
export async function recordNudgeEvent(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(RecordNudgeSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase.from("nudge_events").insert({
        employee_id: employeeId,
        nudge_type: data.nudgeType,
        result: data.result,
        reason: data.reason,
        acknowledged: data.result === "done",
        responded_at: data.result === "done" || data.result === "snoozed" ? new Date().toISOString() : null,
      });
      if (error) {
        return fail(describeDbError(error));
      }
      return ok();
    })
  );
}
