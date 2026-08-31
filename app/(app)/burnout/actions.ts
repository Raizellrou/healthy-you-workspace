"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enqueue } from "@/lib/notify";
import { interventionFor, type InterventionDriverKey } from "@/lib/interventions";
import { addDays, isWeekend, todayInTz } from "@/lib/date";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const DRIVER_KEYS: InterventionDriverKey[] = ["streak", "meeting", "offHours", "pto", "taskLoad", "overdue", "recovery"];

function nextWorkday(from: string): string {
  let day = addDays(from, 1);
  while (isWeekend(day)) day = addDays(day, 1);
  return day;
}

const CreateInterventionSchema = z.object({
  employeeId: z.uuid(),
  driver: z.enum(DRIVER_KEYS as [InterventionDriverKey, ...InterventionDriverKey[]]),
  scoreAtCreation: z.number().int().min(0).max(200),
  note: z.string().max(500).optional(),
});

/**
 * Raises an intervention for `employeeId`, gated at the RLS layer —
 * `interventions` INSERT requires manages(employee_id) or is_hr()
 * (0019_interventions.sql), so this action doesn't re-check the caller's
 * role itself, matching app/(app)/teams/actions.ts#assignManager's
 * reasoning: if that policy ever regresses, this fails loudly instead of
 * silently no-opping. (That file's docstring also notes the one place this
 * rule doesn't apply: tasks/projects, whose RLS never covered these writes
 * to begin with, so those actions self-check role instead.)
 *
 * For driver in {streak, pto} (lib/interventions.ts's `immediate: true`),
 * this also inserts a real pending pto_requests row on the spot — the one
 * case in this feature that performs a write the moment a manager/HR
 * raises it, since a pending request still needs approval like any other.
 * Every other driver stays a tracked 'suggested' row until the subject (or
 * their manager) resolves it via acceptIntervention/dismissIntervention, or
 * — for strict_quiet_hours specifically — applyQuietHoursIntervention,
 * which only the subject themselves can call.
 */
export async function createIntervention(input: unknown): Promise<ActionResult> {
  return withEmployee((actorId) =>
    validated(CreateInterventionSchema, input, async (data) => {
      const supabase = await createClient();
      const spec = interventionFor(data.driver);

      let relatedPtoRequestId: string | null = null;
      let status: "suggested" | "accepted" = "suggested";
      let resolvedAt: string | null = null;

      if (spec.immediate) {
        const { data: employee } = await supabase
          .from("employees")
          .select("timezone")
          .eq("id", data.employeeId)
          .maybeSingle();
        const day = nextWorkday(todayInTz(employee?.timezone));

        const { data: pto, error: ptoError } = await supabase
          .from("pto_requests")
          .insert({
            employee_id: data.employeeId,
            start_date: day,
            end_date: day,
            kind: "mental_health",
            status: "pending",
            note: `Suggested by a burnout intervention: ${spec.label.toLowerCase()}.`,
          })
          .select("id")
          .single();
        if (ptoError) return fail(describeDbError(ptoError));

        relatedPtoRequestId = pto.id as string;
        status = "accepted";
        resolvedAt = new Date().toISOString();
      }

      const { data: intervention, error } = await supabase
        .from("interventions")
        .insert({
          employee_id: data.employeeId,
          created_by: actorId,
          driver: data.driver,
          action_type: spec.actionType,
          status,
          score_at_creation: data.scoreAtCreation,
          note: data.note ?? null,
          related_pto_request_id: relatedPtoRequestId,
          resolved_at: resolvedAt,
        })
        .select("id")
        .single();
      if (error) return fail(describeDbError(error));

      await enqueue({
        recipientId: data.employeeId,
        actorId,
        kind: "intervention_suggested",
        title: spec.immediate
          ? `A day off was requested for you: ${spec.label.toLowerCase()}`
          : `Your manager flagged: ${spec.label}`,
        body: spec.description,
        link: "/burnout",
        entityType: "intervention",
        entityId: intervention.id as string,
      });

      revalidatePath("/burnout");
      if (relatedPtoRequestId) revalidatePath("/time-off");
      return ok({ id: intervention.id as string });
    })
  );
}

/** Generic resolution for every action_type except strict_quiet_hours,
 *  which has no side effect to perform — just marks it handled. Open to
 *  self, manager, or HR (0019's UPDATE policy); the `.eq("status",
 *  "suggested")` guard makes a double-click a no-op instead of an error. */
export async function acceptIntervention(interventionId: string): Promise<ActionResult> {
  return withEmployee(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("interventions")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", interventionId)
      .eq("status", "suggested");
    if (error) return fail(describeDbError(error));
    revalidatePath("/burnout");
    return ok();
  });
}

export async function dismissIntervention(interventionId: string): Promise<ActionResult> {
  return withEmployee(async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("interventions")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", interventionId)
      .eq("status", "suggested");
    if (error) return fail(describeDbError(error));
    revalidatePath("/burnout");
    return ok();
  });
}

/**
 * The strict_quiet_hours action_type's real write: sets the signed-in
 * person's own work_schedules quiet window to cover every non-work hour
 * (quiet_start_min = end_min, quiet_end_min = start_min). Deliberately
 * self-only — a manager/HR can *raise* this suggestion (createIntervention)
 * but never apply it on someone else's behalf, since it changes a personal
 * notification setting, not a work record like a PTO request. The
 * `intervention.employee_id !== employeeId` check enforces that at the app
 * layer too, ahead of work_schedules' own self-only RLS.
 */
export async function applyQuietHoursIntervention(interventionId: string): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();
    const { data: intervention } = await supabase
      .from("interventions")
      .select("id, employee_id, status, action_type")
      .eq("id", interventionId)
      .maybeSingle();
    if (!intervention || intervention.employee_id !== employeeId) return fail("Intervention not found.");
    if (intervention.action_type !== "strict_quiet_hours") return fail("Not applicable to this intervention.");
    if (intervention.status !== "suggested") return fail("Already resolved.");

    const { data: schedule } = await supabase
      .from("work_schedules")
      .select("start_min, end_min")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (!schedule) return fail("No work schedule found.");

    const { error: scheduleError } = await supabase
      .from("work_schedules")
      .update({ quiet_start_min: schedule.end_min, quiet_end_min: schedule.start_min })
      .eq("employee_id", employeeId);
    if (scheduleError) return fail(describeDbError(scheduleError));

    await supabase
      .from("interventions")
      .update({ status: "accepted", resolved_at: new Date().toISOString() })
      .eq("id", interventionId);

    revalidatePath("/burnout");
    revalidatePath("/settings/schedule");
    return ok();
  });
}
