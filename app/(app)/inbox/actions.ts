"use server";

import { revalidatePath } from "next/cache";
import { markRead, markAllRead } from "@/lib/notify";
import { ok, withEmployee, type ActionResult } from "@/lib/action-result";

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  await markRead(notificationId);
  revalidatePath("/inbox");
  return ok();
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    await markAllRead(employeeId);
    revalidatePath("/inbox");
    return ok();
  });
}
