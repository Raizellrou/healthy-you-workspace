import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson, getVisibleEmployees, getTeams } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals, getRebalanceCandidates } from "@/lib/supabase/tasks";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { capacityLoad } from "@/lib/tasks";
import { buildAgenda, pressingCount, type AgendaItem } from "@/lib/one-on-one";
import { addDays, todayInTz, type IsoDate } from "@/lib/date";
import type { Person } from "@/types/person";

/**
 * Fetch layer for the 1:1 surface. All ranking and threshold logic lives in
 * lib/one-on-one.ts; this module gathers rows and hands them over.
 *
 * Note what is NOT fetched here: mood_checkins. It is self-only RLS and
 * would come back empty for anyone else's rows anyway, but the point is
 * that it is not attempted — see 0021_one_on_ones.sql's header.
 */

const RECOGNITION_WINDOW_DAYS = 30;
const OFF_HOURS_WINDOW_DAYS = 30;

export interface ReportAgenda {
  person: Person;
  band: string;
  score: number;
  items: AgendaItem[];
  pressing: number;
  /** The most recent 1:1 with this person, whatever its status. */
  lastMeeting: OneOnOne | null;
}

export interface OneOnOne {
  id: string;
  managerId: string;
  managerName: string;
  employeeId: string;
  employeeName: string;
  employeeAvatarColor: string;
  scheduledFor: IsoDate;
  status: "scheduled" | "completed" | "cancelled";
  agenda: AgendaItem[];
  sharedNotes: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface OneOnOneRow {
  id: string;
  manager_id: string;
  employee_id: string;
  scheduled_for: IsoDate;
  status: "scheduled" | "completed" | "cancelled";
  agenda: AgendaItem[] | null;
  shared_notes: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Who the signed-in person may schedule a 1:1 with — deliberately the exact
 * set 0021's INSERT policy accepts (`manages(employee_id) or is_hr()`), so
 * the UI can never offer somebody the database will then reject.
 */
export async function getSchedulableReports(me: Person): Promise<Person[]> {
  const [people, teams] = await Promise.all([getVisibleEmployees(), getTeams()]);
  if (me.appRole === "hr") return people.filter((p) => p.id !== me.id);

  const managedTeamIds = new Set(teams.filter((t) => t.managerId === me.id).map((t) => t.id));
  return people.filter((p) => p.id !== me.id && p.teamId && managedTeamIds.has(p.teamId));
}

/** Every 1:1 the caller can see. RLS decides that: your own, your team's if
 *  you manage them, everything if HR. */
export async function getOneOnOnes(): Promise<OneOnOne[]> {
  const supabase = await createClient();
  const [res, employees] = await Promise.all([
    supabase
      .from("one_on_ones")
      .select("id, manager_id, employee_id, scheduled_for, status, agenda, shared_notes, created_at, completed_at")
      .order("scheduled_for", { ascending: false })
      .returns<OneOnOneRow[]>(),
    getEmployees(),
  ]);
  if (res.error) {
    throw new Error(`Failed to load 1:1s: ${res.error.message}`);
  }
  const lookup = new Map(employees.map((e) => [e.id, e]));

  return (res.data ?? []).map((row) => ({
    id: row.id,
    managerId: row.manager_id,
    managerName: lookup.get(row.manager_id)?.name ?? "Unknown",
    employeeId: row.employee_id,
    employeeName: lookup.get(row.employee_id)?.name ?? "Unknown",
    employeeAvatarColor: lookup.get(row.employee_id)?.avatarColor ?? "#94a3b8",
    scheduledFor: row.scheduled_for,
    status: row.status,
    agenda: Array.isArray(row.agenda) ? row.agenda : [],
    sharedNotes: row.shared_notes,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

/**
 * Builds a live agenda for each person the caller can schedule with. Every
 * signal is one already visible to a manager under 0010's
 * can_see_employee(); this just assembles them in one pass so a manager
 * doesn't have to visit six screens before a conversation.
 */
export async function getReportAgendas(me: Person): Promise<ReportAgenda[]> {
  const supabase = await createClient();
  const reports = await getSchedulableReports(me);
  if (reports.length === 0) return [];

  const reportIds = reports.map((p) => p.id);
  const today = todayInTz(me.timezone);
  const windowStartIso = `${addDays(today, -RECOGNITION_WINDOW_DAYS)}T00:00:00.000Z`;
  const offHoursStartIso = `${addDays(today, -OFF_HOURS_WINDOW_DAYS)}T00:00:00.000Z`;
  const timezoneById = new Map(reports.map((p) => [p.id, p.timezone]));

  const [employees, attendance, taskSignals, rebalance, kudosRes, eventsRes, interventionsRes, meetings] =
    await Promise.all([
      getEmployees(),
      getAttendanceSignals(reportIds, timezoneById, today),
      getTaskBurnoutSignals(reportIds, today),
      getRebalanceCandidates(),
      supabase
        .from("kudos")
        .select("to_employee_id")
        .in("to_employee_id", reportIds)
        .gte("created_at", windowStartIso)
        .returns<{ to_employee_id: string | null }[]>(),
      supabase
        .from("task_events")
        .select("actor_id")
        .in("actor_id", reportIds)
        .eq("is_off_hours", true)
        .gte("created_at", offHoursStartIso)
        .returns<{ actor_id: string }[]>(),
      supabase
        .from("interventions")
        .select("employee_id")
        .in("employee_id", reportIds)
        .eq("status", "suggested")
        .returns<{ employee_id: string }[]>(),
      getOneOnOnes(),
    ]);

  // Distinguishes "went 90 days without leave" from "has no leave records at
  // all" — daysSincePto saturates at the window length for both, which would
  // otherwise make the agenda shout about everyone. See AgendaInput.hasPtoHistory.
  const { data: ptoRows } = await supabase
    .from("pto_requests")
    .select("employee_id")
    .in("employee_id", reportIds)
    .eq("status", "approved")
    .lte("start_date", today)
    .returns<{ employee_id: string }[]>();
  const withPtoHistory = new Set((ptoRows ?? []).map((r) => r.employee_id));

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const recognised = new Set((kudosRes.data ?? []).map((k) => k.to_employee_id).filter(Boolean) as string[]);

  const offHoursByEmployee = new Map<string, number>();
  for (const row of eventsRes.data ?? []) {
    offHoursByEmployee.set(row.actor_id, (offHoursByEmployee.get(row.actor_id) ?? 0) + 1);
  }
  const openInterventions = new Map<string, number>();
  for (const row of interventionsRes.data ?? []) {
    openInterventions.set(row.employee_id, (openInterventions.get(row.employee_id) ?? 0) + 1);
  }
  const lastMeetingByEmployee = new Map<string, OneOnOne>();
  for (const meeting of meetings) {
    if (!lastMeetingByEmployee.has(meeting.employeeId)) lastMeetingByEmployee.set(meeting.employeeId, meeting);
  }

  return reports
    .map((person) => {
      const employee = employeeById.get(person.id);
      const signals = attendance.get(person.id);
      const tasks = taskSignals.get(person.id);
      const committed = rebalance.people.find((r) => r.employeeId === person.id)?.committedHours ?? 0;

      // Someone visible in `employees` but absent from the frozen query
      // layer's stats shouldn't crash the page — score them as calm rather
      // than dropping them off their manager's list entirely.
      const scores = employee
        ? buildBurnoutV2(employee, signals, tasks, person.weeklyCapacityHours).scores
        : null;

      const items = buildAgenda({
        band: scores?.bandV2 ?? "low",
        score: scores?.compositeV2 ?? 0,
        overdueTaskCount: tasks?.overdueTaskCount ?? 0,
        loadPct: capacityLoad(committed, person.weeklyCapacityHours),
        streakDays: signals?.streakDays ?? 0,
        daysSincePto: signals?.daysSincePto ?? 0,
        hasPtoHistory: withPtoHistory.has(person.id),
        noBreakDayCount: signals?.noBreakDayCount ?? 0,
        weekendWorkDayCount: signals?.weekendWorkDayCount ?? 0,
        offHoursEventCount: offHoursByEmployee.get(person.id) ?? 0,
        recognisedRecently: recognised.has(person.id),
        openInterventionCount: openInterventions.get(person.id) ?? 0,
      });

      return {
        person,
        band: scores?.bandV2 ?? "low",
        score: Math.round(scores?.compositeV2 ?? 0),
        items,
        pressing: pressingCount(items),
        lastMeeting: lastMeetingByEmployee.get(person.id) ?? null,
      };
    })
    .sort((a, b) => b.pressing - a.pressing || b.score - a.score || a.person.name.localeCompare(b.person.name));
}

/** The signed-in person's own 1:1 history — the subject's view of records
 *  written about them. Nothing here is hidden from them by design. */
export async function getMyOneOnOnes(): Promise<OneOnOne[]> {
  const me = await getCurrentPerson();
  if (!me) return [];
  const all = await getOneOnOnes();
  return all.filter((m) => m.employeeId === me.id);
}
