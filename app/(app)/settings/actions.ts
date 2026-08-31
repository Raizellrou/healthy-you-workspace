"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";

const UpdateScheduleSchema = z.object({
  workdays: z.array(z.number().int().min(1).max(7)).max(7),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(0).max(1439),
  quietStartMin: z.number().int().min(0).max(1439),
  quietEndMin: z.number().int().min(0).max(1439),
});

/** Working hours, workdays, and quiet hours — what
 *  lib/schedule.ts#resolveDeliverAfter reads for every notification headed
 *  your way. This screen is the answer to "your working hours are a
 *  global constant": before P6, WORK_START_MIN/WORK_END_MIN (lib/constants.ts)
 *  applied to everyone identically. */
export async function updateSchedule(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(UpdateScheduleSchema, input, async (data) => {
      if (data.startMin >= data.endMin) {
        return fail("Start time must be before end time.");
      }
      const supabase = await createClient();
      const { error } = await supabase
        .from("work_schedules")
        .update({
          workdays: data.workdays,
          start_min: data.startMin,
          end_min: data.endMin,
          quiet_start_min: data.quietStartMin,
          quiet_end_min: data.quietEndMin,
          // Marks the schedule as deliberately chosen, which retires the
          // first-run prompt on the dashboard. Set on every save, not just
          // the first — an idempotent timestamp is simpler than a read
          // followed by a conditional write.
          configured_at: new Date().toISOString(),
        })
        .eq("employee_id", employeeId);
      if (error) {
        return fail(describeDbError(error));
      }
      revalidatePath("/settings/schedule");
      return ok();
    })
  );
}

const UpdatePrefsSchema = z.object({
  batchingMode: z.enum(["immediate", "hourly", "daily_digest"]),
  mutedKinds: z.array(
    z.enum([
      "task_assigned",
      "mention",
      "pto_decided",
      "due_soon",
      "message_held",
      "task_reassigned",
      "intervention_suggested",
      "one_on_one_scheduled",
      "coffee_proposed",
    ])
  ),
});

export async function updateNotificationPrefs(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(UpdatePrefsSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase
        .from("notification_prefs")
        .update({ batching_mode: data.batchingMode, muted_kinds: data.mutedKinds })
        .eq("employee_id", employeeId);
      if (error) {
        return fail(describeDbError(error));
      }
      revalidatePath("/settings/schedule");
      return ok();
    })
  );
}

const UpdateUiPreferencesSchema = z.object({
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  fontScale: z.number().min(0.85).max(1.3),
  density: z.enum(["comfortable", "compact"]),
  singleColumn: z.boolean(),
  mutedPalette: z.boolean(),
  hideAvatars: z.boolean(),
  defaultTaskView: z.enum(["list", "board", "calendar", "timeline"]),
});

export async function updateUiPreferences(input: unknown): Promise<ActionResult> {
  return withEmployee((employeeId) =>
    validated(UpdateUiPreferencesSchema, input, async (data) => {
      const supabase = await createClient();
      const { error } = await supabase
        .from("ui_preferences")
        .update({
          reduced_motion: data.reducedMotion,
          high_contrast: data.highContrast,
          font_scale: data.fontScale,
          density: data.density,
          single_column: data.singleColumn,
          muted_palette: data.mutedPalette,
          hide_avatars: data.hideAvatars,
          default_task_view: data.defaultTaskView,
        })
        .eq("employee_id", employeeId);
      if (error) {
        return fail(describeDbError(error));
      }
      // Every route under (app) reads this in the shared layout, so a
      // narrower revalidatePath wouldn't actually refresh the applied
      // attributes on whatever page the user is currently on.
      revalidatePath("/", "layout");
      return ok();
    })
  );
}
