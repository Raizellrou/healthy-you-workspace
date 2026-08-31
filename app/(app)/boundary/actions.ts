"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployee } from "@/lib/supabase/queries";
import { evaluateBoundaryV2 } from "@/lib/boundary-v2";
import { nextWorkStart, DEFAULT_QUIET_START_MIN, DEFAULT_QUIET_END_MIN, type WorkSchedule } from "@/lib/schedule";
import { DEFAULT_TIMEZONE } from "@/lib/date";
import { enqueue } from "@/lib/notify";
import { sendSlackMessage } from "@/lib/slack";
import { ok, fail, withEmployee, describeDbError, type ActionResult } from "@/lib/action-result";
import type { ActivityEntry } from "@/types/boundary";

export interface SendBoundaryResult {
  ok: boolean;
  error?: string;
  entry?: ActivityEntry;
}

interface AvailabilityRow {
  timezone: string;
  workdays: number[];
  start_min: number;
  end_min: number;
  on_pto: boolean;
  pto_return_date: string | null;
}

/** get_recipient_availability doesn't carry per-employee quiet-hours
 *  minutes, so this fills in the app-wide defaults (lib/schedule.ts) rather
 *  than leaving them unset — evaluateBoundaryV2 does check isQuietHours,
 *  same as the real notification pipeline, so these need a real value. */
function toSchedule(row: AvailabilityRow | null): WorkSchedule {
  if (!row) {
    return {
      timezone: DEFAULT_TIMEZONE,
      workdays: [1, 2, 3, 4, 5],
      startMin: 9 * 60,
      endMin: 18 * 60,
      quietStartMin: DEFAULT_QUIET_START_MIN,
      quietEndMin: DEFAULT_QUIET_END_MIN,
    };
  }
  return {
    timezone: row.timezone,
    workdays: row.workdays as WorkSchedule["workdays"],
    startMin: row.start_min,
    endMin: row.end_min,
    quietStartMin: DEFAULT_QUIET_START_MIN,
    quietEndMin: DEFAULT_QUIET_END_MIN,
  };
}

export async function sendBoundaryMessage(
  recipientId: string,
  sendAtIso: string,
  channel: "Slack" | "Email",
  message: string
): Promise<SendBoundaryResult> {
  const senderId = await getCurrentEmployeeId();
  if (!senderId) {
    return { ok: false, error: "Not signed in." };
  }

  const [sender, recipient] = await Promise.all([getEmployee(senderId), getEmployee(recipientId)]);
  if (!sender || !recipient) {
    return { ok: false, error: "Employee not found." };
  }

  const supabase = await createClient();
  const { data: availability } = await supabase
    .rpc("get_recipient_availability", { target_employee_id: recipientId })
    .maybeSingle<AvailabilityRow>();
  const schedule = toSchedule(availability ?? null);

  const instant = new Date(sendAtIso);
  if (Number.isNaN(instant.getTime())) {
    return { ok: false, error: "Invalid send time." };
  }

  const result = evaluateBoundaryV2({
    senderId,
    recipientId,
    recipientSchedule: schedule,
    recipientOnPto: availability?.on_pto ?? false,
    recipientReturnDate: availability?.pto_return_date ?? null,
    instant,
    message,
  });

  const preview = message.length > 40 ? `${message.slice(0, 40)}…` : message;
  const sentAt = new Date();
  const scheduledDelivery = result.status === "delayed" ? nextWorkStart(schedule, instant) : null;

  const { data, error } = await supabase
    .from("boundary_events")
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      channel,
      message_preview: preview,
      action: result.status,
      sent_at: sentAt.toISOString(),
      scheduled_delivery: scheduledDelivery ? scheduledDelivery.toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: describeDbError(error) };
  }

  if (result.status === "delayed") {
    await enqueue({
      recipientId,
      actorId: senderId,
      kind: "message_held",
      title: `A message from ${sender.name} is held until you're back`,
      body: preview,
      link: "/boundary",
      entityType: "boundary_event",
      entityId: data.id as string,
    });
  }

  // Only a "delivered" result is actually sent anywhere real — "delayed"
  // means Right to Disconnect is deliberately not letting it out yet, and
  // there's no scheduler in this app to fire it later, so posting to Slack
  // now would defeat the feature. "blocked"/"warned" never reach this line.
  let resultMessage = result.message;
  if (result.status === "delivered" && channel === "Slack") {
    const slackResult = await sendSlackMessage(`*${sender.name} → ${recipient.name}*\n${message}`);
    if (slackResult.ok) resultMessage = `${result.message} (sent to Slack)`;
  }

  return {
    ok: true,
    entry: {
      id: data.id as string,
      preview,
      status: result.status,
      message: resultMessage,
      timestamp: sentAt.getTime(),
      recipientId,
      recipientName: recipient.name,
      scheduledDelivery: scheduledDelivery ? scheduledDelivery.toISOString() : null,
    },
  };
}

/** Cancels a message still held for the recipient's working hours. Guarded
 *  both here (`.eq("action", "delayed")`) and at the database level (0032's
 *  RLS policy carries the same condition), so a message that's already
 *  "delivered" can't be cancelled even if this were somehow called on a
 *  stale client-side row. */
export async function cancelBoundaryMessage(id: string): Promise<ActionResult> {
  return withEmployee(async (employeeId) => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("boundary_events")
      .update({ action: "cancelled" })
      .eq("id", id)
      .eq("sender_id", employeeId)
      .eq("action", "delayed")
      .select("id")
      .maybeSingle();
    if (error) {
      return fail(describeDbError(error));
    }
    if (!data) {
      return fail("This message can no longer be cancelled.");
    }
    revalidatePath("/boundary");
    return ok();
  });
}
