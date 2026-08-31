import { createClient } from "@/lib/supabase/server";
import { buildDayTimeline, type FocusBlock } from "@/lib/focus-timeline";
import type { IsoDate } from "@/lib/date";

/**
 * Sibling to the frozen lib/supabase/queries.ts. focus_sessions is new
 * (0016/P7); this module is the fetch layer over it plus the real,
 * work_sessions/session_breaks-derived day timeline that replaces the
 * fake lib/constants.ts#FOCUS_TIMELINE.
 */

export type FocusMode = "standard" | "focus" | "calm";
export type FocusTrigger = "manual" | "auto_burnout" | "auto_meeting_free";

export interface OpenFocusSession {
  id: string;
  mode: FocusMode;
  trigger: FocusTrigger;
  startedAt: string;
}

export async function getOpenFocusSession(employeeId: string): Promise<OpenFocusSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("id, mode, trigger, started_at")
    .eq("employee_id", employeeId)
    .is("ended_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load focus session: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id as string,
    mode: data.mode as FocusMode,
    trigger: data.trigger as FocusTrigger,
    startedAt: data.started_at as string,
  };
}

// A fixed display window wide enough to cover any realistic clock-in, not
// tied to each employee's exact configured schedule — keeps this to one
// bounded query per data type instead of one round trip per employee.
const WINDOW_START_MIN = 6 * 60;
const WINDOW_END_MIN = 22 * 60;

/** Today's real clocked-time timeline for every employee in `employeeIds`,
 *  built from that day's work_sessions/session_breaks. */
export async function getTodayTimelines(
  employeeIds: string[],
  timezoneByEmployee: Map<string, string>,
  today: IsoDate
): Promise<Map<string, FocusBlock[]>> {
  if (employeeIds.length === 0) return new Map();
  const supabase = await createClient();
  const [sessionsRes, breaksJoin] = await Promise.all([
    supabase
      .from("work_sessions")
      .select("id, employee_id, clock_in, clock_out")
      .in("employee_id", employeeIds)
      .eq("work_date", today)
      .returns<{ id: string; employee_id: string; clock_in: string; clock_out: string | null }[]>(),
    supabase
      .from("work_sessions")
      .select("id, employee_id")
      .in("employee_id", employeeIds)
      .eq("work_date", today)
      .returns<{ id: string; employee_id: string }[]>(),
  ]);
  const sessions = sessionsRes.data ?? [];
  const sessionIds = (breaksJoin.data ?? []).map((s) => s.id);

  const { data: breakRows } =
    sessionIds.length > 0
      ? await supabase
          .from("session_breaks")
          .select("session_id, break_start, break_end")
          .in("session_id", sessionIds)
          .returns<{ session_id: string; break_start: string; break_end: string | null }[]>()
      : { data: [] as { session_id: string; break_start: string; break_end: string | null }[] };

  const sessionEmployee = new Map(sessions.map((s) => [s.id, s.employee_id]));
  const now = new Date();
  const out = new Map<string, FocusBlock[]>();

  for (const employeeId of employeeIds) {
    const empSessions = sessions
      .filter((s) => s.employee_id === employeeId)
      .map((s) => ({ clockIn: s.clock_in, clockOut: s.clock_out }));
    const empSessionIds = new Set(sessions.filter((s) => s.employee_id === employeeId).map((s) => s.id));
    const empBreaks = (breakRows ?? [])
      .filter((b) => empSessionIds.has(b.session_id) && sessionEmployee.get(b.session_id) === employeeId)
      .map((b) => ({ breakStart: b.break_start, breakEnd: b.break_end }));

    out.set(
      employeeId,
      buildDayTimeline({
        sessions: empSessions,
        breaks: empBreaks,
        timezone: timezoneByEmployee.get(employeeId) ?? "Asia/Manila",
        windowStartMin: WINDOW_START_MIN,
        windowEndMin: WINDOW_END_MIN,
        now,
      })
    );
  }
  return out;
}

export { WINDOW_START_MIN, WINDOW_END_MIN };

/** Count of each employee's own open (not-done) tasks due today — a real
 *  signal for "how loaded is today", standing in for the fake
 *  FOCUS_TIMELINE's meeting blocks since there's no calendar_events table. */
export async function getDueTodayCounts(employeeIds: string[], today: IsoDate): Promise<Map<string, number>> {
  if (employeeIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("assignee_id")
    .in("assignee_id", employeeIds)
    .eq("due_date", today)
    .eq("done", false)
    .is("deleted_at", null)
    .returns<{ assignee_id: string }[]>();
  if (error) {
    throw new Error(`Failed to load due-today tasks: ${error.message}`);
  }
  const out = new Map<string, number>();
  for (const row of data ?? []) {
    out.set(row.assignee_id, (out.get(row.assignee_id) ?? 0) + 1);
  }
  return out;
}
