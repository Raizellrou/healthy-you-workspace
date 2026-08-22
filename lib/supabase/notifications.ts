import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import type { NotificationKind } from "@/lib/notify";

/**
 * Sibling read layer for the P6 notification funnel. lib/notify.ts owns
 * writes (enqueue/markRead); this module is fetch-and-join only — same
 * split as lib/tasks.ts (math) vs lib/supabase/tasks.ts (fetch).
 */

export type NotificationStatus = "unread" | "held" | "read";

export interface InboxNotification {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatarColor: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  deliverAfter: string;
  heldReason: "quiet_hours" | "batched" | null;
  readAt: string | null;
  status: NotificationStatus;
}

interface NotificationRow {
  id: string;
  actor_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  deliver_after: string;
  held_reason: "quiet_hours" | "batched" | null;
  read_at: string | null;
}

/** Every notification for `employeeId`, newest first, each annotated with
 *  the status the inbox tabs split on. "held" vs "unread" is purely a
 *  function of `deliver_after <= now()` — computed here at read time, not
 *  stored, so nothing has to run to "release" a held notification. */
export async function getInboxNotifications(employeeId: string, limit = 200): Promise<InboxNotification[]> {
  const supabase = await createClient();
  const [notifRes, employees] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, actor_id, kind, title, body, link, created_at, deliver_after, held_reason, read_at")
      .eq("recipient_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<NotificationRow[]>(),
    getEmployees(),
  ]);
  if (notifRes.error) {
    throw new Error(`Failed to load notifications: ${notifRes.error.message}`);
  }

  const lookup = new Map(employees.map((e) => [e.id, e]));
  const now = Date.now();

  return (notifRes.data ?? []).map((r) => {
    const actor = r.actor_id ? lookup.get(r.actor_id) : undefined;
    const status: NotificationStatus = r.read_at ? "read" : new Date(r.deliver_after).getTime() <= now ? "unread" : "held";
    return {
      id: r.id,
      actorId: r.actor_id,
      actorName: actor?.name ?? null,
      actorAvatarColor: actor?.avatarColor ?? null,
      kind: r.kind,
      title: r.title,
      body: r.body,
      link: r.link,
      createdAt: r.created_at,
      deliverAfter: r.deliver_after,
      heldReason: r.held_reason,
      readAt: r.read_at,
      status,
    };
  });
}

/** Delivered-and-unread count — what the Sidebar's InboxBell badge shows. */
export async function getUnreadCount(employeeId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", employeeId)
    .is("read_at", null)
    .lte("deliver_after", new Date().toISOString());
  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }
  return count ?? 0;
}

export interface WorkScheduleSettings {
  workdays: number[];
  startMin: number;
  endMin: number;
  quietStartMin: number;
  quietEndMin: number;
}

export interface NotificationPrefsSettings {
  batchingMode: "immediate" | "hourly" | "daily_digest";
  mutedKinds: string[];
}

export async function getMySettings(
  employeeId: string
): Promise<{ schedule: WorkScheduleSettings; prefs: NotificationPrefsSettings }> {
  const supabase = await createClient();
  const [scheduleRes, prefsRes] = await Promise.all([
    supabase
      .from("work_schedules")
      .select("workdays, start_min, end_min, quiet_start_min, quiet_end_min")
      .eq("employee_id", employeeId)
      .single(),
    supabase.from("notification_prefs").select("batching_mode, muted_kinds").eq("employee_id", employeeId).single(),
  ]);
  if (scheduleRes.error) {
    throw new Error(`Failed to load work schedule: ${scheduleRes.error.message}`);
  }
  if (prefsRes.error) {
    throw new Error(`Failed to load notification prefs: ${prefsRes.error.message}`);
  }

  return {
    schedule: {
      workdays: scheduleRes.data.workdays,
      startMin: scheduleRes.data.start_min,
      endMin: scheduleRes.data.end_min,
      quietStartMin: scheduleRes.data.quiet_start_min,
      quietEndMin: scheduleRes.data.quiet_end_min,
    },
    prefs: {
      batchingMode: prefsRes.data.batching_mode,
      mutedKinds: prefsRes.data.muted_kinds,
    },
  };
}
