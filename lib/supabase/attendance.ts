import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import { addDays, type IsoDate } from "@/lib/date";
import {
  avgNetHours,
  consecutiveWorkDays,
  daysSincePto,
  expandPtoDates,
  isOnPtoToday,
  lateClockOuts,
  noBreakDays,
  rollupDays,
  weekendWorkDays,
  type DayRollup,
  type SessionBreakRow,
  type WorkSessionRow,
} from "@/lib/attendance";

/**
 * Sibling to the frozen `lib/supabase/queries.ts` and to `lib/attendance.ts`
 * (which does the actual math, unit-tested, over plain rows). This module is
 * only fetch-and-group: every real computation happens in lib/attendance.ts.
 */

interface PtoRow {
  employee_id: string;
  start_date: IsoDate;
  end_date: IsoDate;
  status: "pending" | "approved" | "denied" | "cancelled";
}

export interface OpenSession {
  id: string;
  employeeId: string;
  clockIn: string;
  workDate: IsoDate;
  openBreak: { id: string; breakStart: string; kind: string } | null;
  /** End of the most recent completed break in this session, if any. The
   *  P8 guardrails measure "time since your last break" from here, falling
   *  back to clock-in when nothing has been taken yet. */
  lastBreakEnd: string | null;
  breakCount: number;
  /** Total milliseconds across this session's already-*completed* breaks
   *  (excludes a currently open one — a live "breaks today" display adds
   *  that itself from `openBreak.breakStart`, the same way ClockWidget
   *  derives its own elapsed reading from `clockIn` rather than a
   *  server-computed snapshot that would go stale between ticks). */
  completedBreakMs: number;
}

/** The signed-in person's currently open session (if any) and, if they're
 *  on a break right now, that break too. Drives the sidebar ClockWidget. */
export async function getOpenSession(employeeId: string): Promise<OpenSession | null> {
  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("work_sessions")
    .select("id, employee_id, clock_in, work_date")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load open session: ${error.message}`);
  }
  if (!session) return null;

  const { data: breaks } = await supabase
    .from("session_breaks")
    .select("id, break_start, break_end, kind")
    .eq("session_id", session.id)
    .order("break_start", { ascending: true })
    .returns<{ id: string; break_start: string; break_end: string | null; kind: string }[]>();

  const rows = breaks ?? [];
  const openBreak = rows.find((b) => b.break_end === null) ?? null;
  const completed = rows.filter((b) => b.break_end !== null);
  const lastBreakEnd = completed.length > 0 ? completed[completed.length - 1].break_end : null;
  const completedBreakMs = completed.reduce(
    (sum, b) => sum + (new Date(b.break_end as string).getTime() - new Date(b.break_start).getTime()),
    0
  );

  return {
    id: session.id,
    employeeId: session.employee_id,
    clockIn: session.clock_in,
    workDate: session.work_date,
    openBreak: openBreak ? { id: openBreak.id, breakStart: openBreak.break_start, kind: openBreak.kind } : null,
    lastBreakEnd,
    breakCount: completed.length,
    completedBreakMs,
  };
}

/** One person's daily rollups over the trailing window — the personal
 *  timesheet view. */
export async function getMyRollups(employeeId: string, days = 30): Promise<DayRollup[]> {
  const supabase = await createClient();
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -days);

  const { data: sessions, error } = await supabase
    .from("work_sessions")
    .select("id, employee_id, clock_in, clock_out, work_date")
    .eq("employee_id", employeeId)
    .gte("work_date", cutoff)
    .returns<WorkSessionRow[]>();
  if (error) {
    throw new Error(`Failed to load work sessions: ${error.message}`);
  }
  const rows = sessions ?? [];
  if (rows.length === 0) return [];

  const { data: breaks } = await supabase
    .from("session_breaks")
    .select("id, session_id, break_start, break_end")
    .in(
      "session_id",
      rows.map((r) => r.id)
    )
    .returns<SessionBreakRow[]>();

  return rollupDays(rows, breaks ?? []);
}

/** Every open session the caller can see (self/team/org, via RLS), joined
 *  with employee name — the "who's clocked in right now" board. */
export async function getVisibleOpenSessions(): Promise<
  { employeeId: string; name: string; avatarColor: string; clockIn: string; onBreak: boolean }[]
> {
  const supabase = await createClient();
  const [sessionsRes, employees] = await Promise.all([
    supabase
      .from("work_sessions")
      .select("id, employee_id, clock_in")
      .is("clock_out", null)
      .returns<{ id: string; employee_id: string; clock_in: string }[]>(),
    getEmployees(),
  ]);
  if (sessionsRes.error) {
    throw new Error(`Failed to load open sessions: ${sessionsRes.error.message}`);
  }
  const sessions = sessionsRes.data ?? [];
  if (sessions.length === 0) return [];

  const { data: openBreaks } = await supabase
    .from("session_breaks")
    .select("session_id")
    .is("break_end", null)
    .in(
      "session_id",
      sessions.map((s) => s.id)
    )
    .returns<{ session_id: string }[]>();
  const onBreakSessionIds = new Set((openBreaks ?? []).map((b) => b.session_id));

  const lookup = new Map(employees.map((e) => [e.id, e]));
  return sessions
    .map((s) => {
      const employee = lookup.get(s.employee_id);
      if (!employee) return null;
      return {
        employeeId: s.employee_id,
        name: employee.name,
        avatarColor: employee.avatarColor,
        clockIn: s.clock_in,
        onBreak: onBreakSessionIds.has(s.id),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export interface PtoRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  avatarColor: string;
  startDate: IsoDate;
  endDate: IsoDate;
  kind: "vacation" | "sick" | "personal" | "mental_health";
  status: "pending" | "approved" | "denied" | "cancelled";
  note: string | null;
  createdAt: string;
}

/** Every PTO request the caller can see (self/team/org, via RLS). The
 *  time-off page splits this into "mine" and "pending decisions for
 *  others" — no separate query for each. */
export async function getVisiblePtoRequests(): Promise<PtoRequest[]> {
  const supabase = await createClient();
  const [ptoRes, employees] = await Promise.all([
    supabase
      .from("pto_requests")
      .select("id, employee_id, start_date, end_date, kind, status, note, created_at")
      .order("start_date", { ascending: false }),
    getEmployees(),
  ]);
  if (ptoRes.error) {
    throw new Error(`Failed to load PTO requests: ${ptoRes.error.message}`);
  }
  const lookup = new Map(employees.map((e) => [e.id, e]));

  return (ptoRes.data ?? []).flatMap((row) => {
    const employee = lookup.get(row.employee_id);
    if (!employee) return [];
    return [
      {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employee.name,
        avatarColor: employee.avatarColor,
        startDate: row.start_date,
        endDate: row.end_date,
        kind: row.kind,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
      },
    ];
  });
}

export interface AttendanceSignals {
  streakDays: number;
  avgNetHours: number;
  lateClockOutCount: number;
  noBreakDayCount: number;
  weekendWorkDayCount: number;
  daysSincePto: number;
  onPto: boolean;
}

const EMPTY_SIGNALS: AttendanceSignals = {
  streakDays: 0,
  avgNetHours: 0,
  lateClockOutCount: 0,
  noBreakDayCount: 0,
  weekendWorkDayCount: 0,
  daysSincePto: 90,
  onPto: false,
};

/**
 * Bulk attendance signals for burnout v2, one query pass for every employee
 * rather than one round trip each — same "aggregate in TS over one fetch"
 * approach as lib/tasks.ts#buildCapacityWorkload. Returns EMPTY_SIGNALS for
 * anyone with no session history yet (a fresh account), matching the
 * frozen query layer's own EMPTY_STATS convention.
 */
export async function getAttendanceSignals(
  employeeIds: string[],
  timezoneByEmployee: Map<string, string>,
  today: IsoDate
): Promise<Map<string, AttendanceSignals>> {
  if (employeeIds.length === 0) return new Map();
  const supabase = await createClient();
  const cutoff = addDays(today, -90);

  const [sessionsRes, ptoRes] = await Promise.all([
    supabase
      .from("work_sessions")
      .select("id, employee_id, clock_in, clock_out, work_date")
      .in("employee_id", employeeIds)
      .gte("work_date", cutoff)
      .returns<WorkSessionRow[]>(),
    supabase
      .from("pto_requests")
      .select("employee_id, start_date, end_date, status")
      .in("employee_id", employeeIds)
      .returns<PtoRow[]>(),
  ]);
  if (sessionsRes.error) {
    throw new Error(`Failed to load work sessions: ${sessionsRes.error.message}`);
  }
  if (ptoRes.error) {
    throw new Error(`Failed to load PTO requests: ${ptoRes.error.message}`);
  }
  const sessions = sessionsRes.data ?? [];
  const pto = ptoRes.data ?? [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: breaks } =
    sessionIds.length > 0
      ? await supabase
          .from("session_breaks")
          .select("id, session_id, break_start, break_end")
          .in("session_id", sessionIds)
          .returns<SessionBreakRow[]>()
      : { data: [] as SessionBreakRow[] };

  const sessionsByEmployee = new Map<string, WorkSessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByEmployee.get(s.employee_id) ?? [];
    list.push(s);
    sessionsByEmployee.set(s.employee_id, list);
  }
  const ptoByEmployee = new Map<string, PtoRow[]>();
  for (const p of pto) {
    const list = ptoByEmployee.get(p.employee_id) ?? [];
    list.push(p);
    ptoByEmployee.set(p.employee_id, list);
  }

  const out = new Map<string, AttendanceSignals>();
  for (const employeeId of employeeIds) {
    const employeeSessions = sessionsByEmployee.get(employeeId);
    const employeePto = ptoByEmployee.get(employeeId) ?? [];
    const timezone = timezoneByEmployee.get(employeeId) ?? "Asia/Manila";

    if (!employeeSessions || employeeSessions.length === 0) {
      out.set(employeeId, {
        ...EMPTY_SIGNALS,
        daysSincePto: daysSincePto(employeePto, today),
        onPto: isOnPtoToday(employeePto, today),
      });
      continue;
    }

    const rollups = rollupDays(employeeSessions, breaks ?? []);
    const ptoDates = expandPtoDates(employeePto);
    const trailing14 = rollups.slice(-14);

    out.set(employeeId, {
      streakDays: consecutiveWorkDays(rollups, ptoDates, today),
      avgNetHours: avgNetHours(trailing14),
      lateClockOutCount: lateClockOuts(trailing14, timezone),
      noBreakDayCount: noBreakDays(trailing14),
      weekendWorkDayCount: weekendWorkDays(trailing14),
      daysSincePto: daysSincePto(employeePto, today),
      onPto: isOnPtoToday(employeePto, today),
    });
  }

  return out;
}
