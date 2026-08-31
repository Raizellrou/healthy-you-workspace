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
  /** False until the person saves their hours for the first time. Every
   *  employee now gets a row with 09:00-18:00 Mon-Fri defaults whether they
   *  asked for them or not (0034), so the row existing no longer means the
   *  settings were chosen — the dashboard uses this to offer a one-time
   *  prompt rather than leaving new people on silent defaults. */
  configured: boolean;
}

export interface NotificationPrefsSettings {
  batchingMode: "immediate" | "hourly" | "daily_digest";
  mutedKinds: string[];
}

/** Mirrors the column defaults in 0014_notifications_and_schedules.sql. Used
 *  when an employee has no row yet — see getMySettings below. */
export const DEFAULT_WORK_SCHEDULE: WorkScheduleSettings = {
  workdays: [1, 2, 3, 4, 5],
  startMin: 540,
  endMin: 1080,
  quietStartMin: 1200,
  quietEndMin: 480,
  configured: false,
};

/** Mirrors the column defaults in 0014_notifications_and_schedules.sql. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsSettings = {
  batchingMode: "immediate",
  mutedKinds: [],
};

/**
 * 0014 backfilled work_schedules/notification_prefs for every employee that
 * existed when it ran, and its comment claimed the app would therefore never
 * see a missing row. That held for exactly as long as nobody was onboarded:
 * nothing provisioned rows for employees created afterwards, so `.single()`
 * threw and took out /dashboard and /settings/schedule entirely for them.
 *
 * 0034 adds the trigger that keeps the data correct going forward. This falls
 * back to the same defaults regardless, so a missing row degrades to sensible
 * settings instead of an error boundary — the pattern getUiPreferences() in
 * ./preferences.ts already uses. A genuine query error still throws; only
 * "no row" is absorbed.
 */
export async function getMySettings(
  employeeId: string
): Promise<{ schedule: WorkScheduleSettings; prefs: NotificationPrefsSettings }> {
  const supabase = await createClient();
  const scheduleColumns = "workdays, start_min, end_min, quiet_start_min, quiet_end_min";
  const [scheduleFirst, prefsRes] = await Promise.all([
    supabase
      .from("work_schedules")
      .select(`${scheduleColumns}, configured_at`)
      .eq("employee_id", employeeId)
      .maybeSingle(),
    supabase.from("notification_prefs").select("batching_mode, muted_kinds").eq("employee_id", employeeId).maybeSingle(),
  ]);

  // configured_at arrives with 0034, and in this project schema is applied by
  // hand in the SQL editor rather than by the deploy — so the code can be
  // live before the column exists. Postgres 42703 is undefined_column; on
  // that specific error, fall back to the pre-0034 column set rather than
  // failing the whole dashboard, which is exactly the failure mode this
  // function was just fixed for. Delete this branch once 0034 is applied
  // everywhere.
  const columnMissing = scheduleFirst.error?.code === "42703";
  const scheduleRes = columnMissing
    ? await supabase.from("work_schedules").select(scheduleColumns).eq("employee_id", employeeId).maybeSingle()
    : scheduleFirst;

  if (scheduleRes.error) {
    throw new Error(`Failed to load work schedule: ${scheduleRes.error.message}`);
  }
  if (prefsRes.error) {
    throw new Error(`Failed to load notification prefs: ${prefsRes.error.message}`);
  }

  const schedule = scheduleRes.data;
  const prefs = prefsRes.data;

  return {
    schedule: schedule
      ? {
          workdays: schedule.workdays,
          startMin: schedule.start_min,
          endMin: schedule.end_min,
          quietStartMin: schedule.quiet_start_min,
          quietEndMin: schedule.quiet_end_min,
          // Absent column (pre-0034) reads as configured: better to skip
          // the prompt than to show every existing employee a setup task.
          configured: "configured_at" in schedule ? schedule.configured_at !== null : true,
        }
      : DEFAULT_WORK_SCHEDULE,
    prefs: prefs
      ? {
          batchingMode: prefs.batching_mode,
          mutedKinds: prefs.muted_kinds,
        }
      : DEFAULT_NOTIFICATION_PREFS,
  };
}
