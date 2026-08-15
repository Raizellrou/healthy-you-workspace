"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployee } from "@/lib/supabase/queries";
import { evaluateBoundary, nextCalendarDate } from "@/lib/boundary";
import type { ActivityEntry } from "@/types/boundary";

export interface SendBoundaryResult {
  ok: boolean;
  error?: string;
  entry?: ActivityEntry;
}

export async function sendBoundaryMessage(
  recipientId: string,
  day: number,
  timeMinutes: number,
  channel: "Slack" | "Email",
  message: string
): Promise<SendBoundaryResult> {
  const senderId = await getCurrentEmployeeId();
  if (!senderId) {
    return { ok: false, error: "Not signed in." };
  }

  const [sender, recipient] = await Promise.all([
    getEmployee(senderId),
    getEmployee(recipientId),
  ]);
  if (!sender || !recipient) {
    return { ok: false, error: "Employee not found." };
  }

  // Re-run the exact same pure decision function used for the live preview,
  // so the persisted outcome and what the user saw before hitting Send can
  // never diverge.
  const result = evaluateBoundary(sender, recipient, day, timeMinutes, message);

  const preview = message.length > 40 ? `${message.slice(0, 40)}…` : message;
  const sentAt = new Date();
  const scheduledDelivery =
    result.status === "delayed" ? nextCalendarDate(day, timeMinutes) : null;

  const supabase = await createClient();
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
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    entry: {
      id: data.id as string,
      preview,
      status: result.status,
      message: result.message,
      timestamp: sentAt.getTime(),
    },
  };
}
