import { createClient } from "@/lib/supabase/server";

/**
 * `nudge_preferences.respect_calendar` (0024) — whether to hold ergonomic
 * nudges while the person is in a meeting.
 *
 * Defaults to true when the row or column is missing rather than false: a
 * stretch reminder popping up mid-meeting is the behaviour nobody wants, so
 * the safe fallback is the considerate one. Turning it off should be a
 * deliberate act, not something a missing row decides.
 */
export async function getRespectCalendar(employeeId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("nudge_preferences")
    .select("respect_calendar")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error || !data) return true;
  return (data.respect_calendar as boolean | null) ?? true;
}
