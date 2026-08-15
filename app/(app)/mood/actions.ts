"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";

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
  const today = new Date().toISOString().slice(0, 10);

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
    return { ok: false, error: error.message };
  }

  revalidatePath("/mood");
  return { ok: true };
}
