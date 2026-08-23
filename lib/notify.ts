import { createClient } from "@/lib/supabase/server";
import { resolveDeliverAfter, DEFAULT_SCHEDULE, type BatchingMode, type WorkSchedule } from "@/lib/schedule";
import { todayInTz, addDays, DEFAULT_TIMEZONE, type IsoWeekday } from "@/lib/date";

/**
 * The one notification funnel (P6). Every notification — task assignment,
 * a comment mention, a PTO decision, a due-soon reminder — goes through
 * `enqueue()`, which resolves `deliver_after` via
 * lib/schedule.ts#resolveDeliverAfter before the row is ever written. Right
 * to Disconnect (delay past quiet hours) and batching preferences aren't
 * separate features; they're this one function reading the recipient's own
 * schedule and prefs.
 *
 * Server-only: every export here touches the database. Callers are Server
 * Actions under app/(app)/, never client components directly.
 */

export type NotificationKind =
  | "task_assigned"
  | "mention"
  | "pto_decided"
  | "due_soon"
  | "message_held"
  | "task_reassigned"
  | "intervention_suggested"
  | "one_on_one_scheduled";

/** A hold with no known release time (unlike quiet-hours) — released
 *  explicitly by app/(app)/focus/actions.ts#endFocusSession setting
 *  deliver_after = now() on every row it applies to, never by elapsed
 *  time. This is just a placeholder far enough out that the row reliably
 *  sorts and reads as "held" until that explicit release happens. */
const FOCUS_HOLD_PLACEHOLDER_MS = 365 * 24 * 60 * 60 * 1000;

export interface EnqueueInput {
  recipientId: string;
  actorId: string | null;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  priority?: "low" | "normal" | "high";
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface RecipientContext {
  schedule: WorkSchedule;
  batchingMode: BatchingMode;
  mutedKinds: Set<string>;
  focusSessionOpen: boolean;
}

/**
 * work_schedules/notification_prefs are self-only RLS (0014 — personal
 * settings, not an org-visible signal), but enqueue() runs as the actor
 * (whoever triggers the notification), not the recipient — so a direct
 * table read here would be silently RLS-blocked whenever actor !=
 * recipient, the common case. get_notification_schedule() (0015) is a
 * security definer function, the same pattern as current_employee_id()/
 * is_hr()/manages() (0010), that returns just these fields for any target
 * employee regardless of caller. See 0015's header comment for the bug
 * this fixes — live-caught: a customized schedule had zero effect on
 * notifications someone else sent, silently falling back to defaults.
 */
async function resolveRecipientContext(supabase: SupabaseClient, recipientId: string): Promise<RecipientContext> {
  const [scheduleRes, employeeRes] = await Promise.all([
    supabase.rpc("get_notification_schedule", { target_employee_id: recipientId }).maybeSingle(),
    supabase.from("employees").select("timezone").eq("id", recipientId).maybeSingle(),
  ]);

  const timezone = (employeeRes.data as { timezone: string } | null)?.timezone ?? DEFAULT_TIMEZONE;
  const row = scheduleRes.data as
    | {
        workdays: number[];
        start_min: number;
        end_min: number;
        quiet_start_min: number;
        quiet_end_min: number;
        batching_mode: BatchingMode;
        muted_kinds: string[];
        focus_session_open: boolean;
      }
    | null;

  const schedule: WorkSchedule = row
    ? {
        timezone,
        workdays: row.workdays as IsoWeekday[],
        startMin: row.start_min,
        endMin: row.end_min,
        quietStartMin: row.quiet_start_min,
        quietEndMin: row.quiet_end_min,
      }
    : { ...DEFAULT_SCHEDULE, timezone };

  return {
    schedule,
    batchingMode: row?.batching_mode ?? "immediate",
    mutedKinds: new Set(row?.muted_kinds ?? []),
    focusSessionOpen: row?.focus_session_open ?? false,
  };
}

/** Best-effort by design, matching app/(app)/tasks/actions.ts#recordEvent:
 *  a notification failing to enqueue never fails the mutation it's
 *  describing (a task still gets assigned even if the notify insert 403s
 *  for some unrelated reason). */
export async function enqueue(input: EnqueueInput): Promise<void> {
  const supabase = await createClient();
  const { schedule, batchingMode, mutedKinds, focusSessionOpen } = await resolveRecipientContext(
    supabase,
    input.recipientId
  );
  if (mutedKinds.has(input.kind)) return;

  const resolved = resolveDeliverAfter(schedule, batchingMode, new Date());
  let deliverAfter = resolved.deliverAfter;
  let heldReason: "quiet_hours" | "batched" | "focus_session" | null = resolved.heldReason;

  // Quiet-hours/batching already won if either applied — a focus session
  // only needs to intervene when the notification would otherwise deliver
  // immediately. Unlike a quiet-hours hold, there's no known release
  // instant to compute (nobody knows in advance when a focus session
  // ends), so this uses a far-future placeholder and relies on
  // app/(app)/focus/actions.ts#endFocusSession to explicitly release it.
  if (focusSessionOpen && heldReason === null) {
    deliverAfter = new Date(Date.now() + FOCUS_HOLD_PLACEHOLDER_MS);
    heldReason = "focus_session";
  }

  await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    actor_id: input.actorId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    priority: input.priority ?? "normal",
    deliver_after: deliverAfter.toISOString(),
    held_reason: heldReason,
  });
}

export async function enqueueMany(inputs: EnqueueInput[]): Promise<void> {
  await Promise.all(inputs.map((i) => enqueue(i)));
}

export async function markRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
}

export async function markAllRead(employeeId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", employeeId)
    .is("read_at", null)
    .lte("deliver_after", new Date().toISOString());
}

/**
 * Builds the name -> id lookup parseMentions() takes: every full name,
 * plus each first name that's unique across `employees` (so "@Amara"
 * resolves when there's exactly one Amara, and resolves to nobody rather
 * than the wrong person when there are two).
 */
export function buildMentionLookup(employees: { id: string; name: string }[]): Map<string, string> {
  const firstNameCounts = new Map<string, number>();
  for (const e of employees) {
    const firstName = e.name.split(/\s+/)[0].toLowerCase();
    firstNameCounts.set(firstName, (firstNameCounts.get(firstName) ?? 0) + 1);
  }

  const map = new Map<string, string>();
  for (const e of employees) {
    map.set(e.name.toLowerCase(), e.id);
    const firstName = e.name.split(/\s+/)[0].toLowerCase();
    if (firstNameCounts.get(firstName) === 1) map.set(firstName, e.id);
  }
  return map;
}

const MENTION_RE = /@([A-Za-z][\w'-]*(?:\s[A-Za-z][\w'-]*)?)/g;

/**
 * Extracts @mentions from comment body text and resolves them against
 * `nameToId` (keys lowercased). Tries the full two-word match first, then
 * falls back to just the first word — "@Amara, can you look" shouldn't
 * fail to match "Amara" just because "Adeyemi" isn't next to it. An
 * unresolved @mention is silently ignored; this is a convenience parser,
 * not a validator.
 */
export function parseMentions(body: string, nameToId: Map<string, string>): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    const full = match[1].trim();
    const fullId = nameToId.get(full.toLowerCase());
    if (fullId) {
      found.add(fullId);
      continue;
    }
    const firstWord = full.split(/\s+/)[0];
    const firstId = nameToId.get(firstWord.toLowerCase());
    if (firstId) found.add(firstId);
  }
  return [...found];
}

/**
 * Notifies `employeeId` about their own open tasks due today or tomorrow —
 * the "due_soon" sweep, computed at inbox-read time (no cron). Idempotent
 * per task per day: checks for an existing due_soon notification for that
 * task created today before inserting another.
 */
export async function sweepDueSoon(employeeId: string, timezone?: string): Promise<void> {
  const supabase = await createClient();
  const today = todayInTz(timezone);
  const tomorrow = addDays(today, 1);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("assignee_id", employeeId)
    .eq("done", false)
    .in("due_date", [today, tomorrow])
    .returns<{ id: string; title: string; due_date: string }[]>();
  if (!tasks || tasks.length === 0) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("entity_id")
    .eq("recipient_id", employeeId)
    .eq("kind", "due_soon")
    .gte("created_at", `${today}T00:00:00.000Z`)
    .returns<{ entity_id: string | null }[]>();
  const alreadyNotified = new Set((existing ?? []).map((r) => r.entity_id));

  for (const task of tasks) {
    if (alreadyNotified.has(task.id)) continue;
    await enqueue({
      recipientId: employeeId,
      actorId: null,
      kind: "due_soon",
      title: `"${task.title}" is due ${task.due_date === today ? "today" : "tomorrow"}`,
      link: `/tasks/${task.id}`,
      entityType: "task",
      entityId: task.id,
    });
  }
}
