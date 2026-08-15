"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";

export interface SubmitKudosResult {
  ok: boolean;
  error?: string;
}

export async function submitKudos(
  toEmployeeId: string,
  tag: string,
  note: string,
  flagged: boolean
): Promise<SubmitKudosResult> {
  const fromEmployeeId = await getCurrentEmployeeId();
  if (!fromEmployeeId) {
    return { ok: false, error: "Not signed in." };
  }
  if (fromEmployeeId === toEmployeeId) {
    return { ok: false, error: "Pick someone else to thank." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("kudos").insert({
    from_employee_id: fromEmployeeId,
    to_employee_id: toEmployeeId,
    kudos_type: tag,
    message: note.trim() || null,
    flagged,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/kudos");
  return { ok: true };
}
