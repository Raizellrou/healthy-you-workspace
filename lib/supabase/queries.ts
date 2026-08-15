import { createClient } from "@/lib/supabase/server";
import { computeBurnout } from "@/lib/burnout";
import type { Employee } from "@/types/employee";

const AVATAR_PALETTE = [
  "#0ea5e9",
  "#0369a1",
  "#7c3aed",
  "#0d9488",
  "#c026d3",
  "#4338ca",
  "#0891b2",
  "#9333ea",
] as const;

interface EmployeeRow {
  id: string;
  name: string;
  team: string;
  role: string;
  email: string;
}

interface DailyActivityRow {
  employee_id: string;
  date: string;
  meeting_hours: number;
  available_hours: number;
  off_hours_messages: number;
  worked_today: boolean;
  on_pto: boolean;
}

interface DerivedStats {
  worked: boolean;
  meeting: number;
  offHours: number;
  available: number;
  onPto: boolean;
  meetingAvg: number;
  streakDays: number;
  daysSincePto: number;
  offHoursWeekly: number;
}

const EMPTY_STATS: DerivedStats = {
  worked: false,
  meeting: 0,
  offHours: 0,
  available: 8,
  onPto: false,
  meetingAvg: 0,
  streakDays: 0,
  daysSincePto: 0,
  offHoursWeekly: 0,
};

// `rows` must be sorted descending by date (most recent first) and non-empty.
function deriveStats(rows: DailyActivityRow[]): DerivedStats {
  const latest = rows[0];

  // Streak: consecutive trailing days actually worked (not PTO), counting
  // back from the most recent day until the first gap.
  let streakDays = 0;
  for (const r of rows) {
    if (r.worked_today && !r.on_pto) streakDays++;
    else break;
  }

  // Days since PTO: distance back to the most recent on_pto day within the
  // history window. Falls back to the full window length if no PTO day
  // appears at all in the available history.
  let daysSincePto = rows.length;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].on_pto) {
      daysSincePto = i;
      break;
    }
  }

  // Meeting load average, over the whole window including PTO/off days as
  // zero — this is a utilization-style average (how much of total capacity
  // over the period went to meetings), not just "average on days worked."
  const meetingAvg =
    rows.reduce((sum, r) => sum + r.meeting_hours, 0) / rows.length;

  const offHoursWeekly = rows
    .slice(0, 7)
    .reduce((sum, r) => sum + r.off_hours_messages, 0);

  return {
    worked: latest.worked_today,
    meeting: latest.meeting_hours,
    offHours: latest.off_hours_messages,
    available: latest.available_hours || 8,
    onPto: latest.on_pto,
    meetingAvg,
    streakDays,
    daysSincePto,
    offHoursWeekly,
  };
}

function toEmployee(row: EmployeeRow, index: number, stats: DerivedStats): Employee {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    role: row.role,
    email: row.email,
    avatarColor: AVATAR_PALETTE[index % AVATAR_PALETTE.length],
    // No PTO-return-date column exists in this schema yet — always null
    // until that's tracked. UI treats a null returnIn as "on PTO, no ETA."
    returnIn: null,
    ...stats,
  };
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();

  const [employeesRes, activityRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, team, role, email")
      .order("name")
      .returns<EmployeeRow[]>(),
    supabase
      .from("daily_activity")
      .select("employee_id, date, meeting_hours, available_hours, off_hours_messages, worked_today, on_pto")
      .order("date", { ascending: false })
      .returns<DailyActivityRow[]>(),
  ]);

  if (employeesRes.error) {
    throw new Error(`Failed to load employees: ${employeesRes.error.message}`);
  }
  if (activityRes.error) {
    throw new Error(`Failed to load daily_activity: ${activityRes.error.message}`);
  }

  const activityByEmployee = new Map<string, DailyActivityRow[]>();
  for (const row of activityRes.data ?? []) {
    const list = activityByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    activityByEmployee.set(row.employee_id, list);
  }

  return (employeesRes.data ?? []).map((row, i) => {
    const rows = activityByEmployee.get(row.id);
    const stats = rows && rows.length > 0 ? deriveStats(rows) : EMPTY_STATS;
    return toEmployee(row, i, stats);
  });
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const employees = await getEmployees();
  return employees.find((e) => e.id === id);
}

// Resolves the logged-in session to their employees.id — server actions
// derive identity from this, never from client-supplied values, so a
// request can never act as anyone but the authenticated caller.
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export interface BurnoutHistoryPoint {
  date: string;
  composite: number;
}

// risk_scores only ever holds one current snapshot row per employee (not a
// daily log), so it can't supply a real trend on its own. Instead, this
// reconstructs a genuine 14-day trend by re-running computeBurnout() against
// a trailing daily_activity window ending on each of the last `days` dates —
// real derived history from real data, not a fabrication.
export async function getBurnoutHistory(
  employeeId: string,
  days = 14
): Promise<BurnoutHistoryPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_activity")
    .select("date, meeting_hours, available_hours, off_hours_messages, worked_today, on_pto")
    .eq("employee_id", employeeId)
    .order("date", { ascending: false })
    .returns<DailyActivityRow[]>();

  if (error) {
    throw new Error(`Failed to load daily_activity history: ${error.message}`);
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const targetDates = rows.slice(0, days).map((r) => r.date);

  const points = targetDates.map((date) => {
    const windowRows = rows.filter((r) => r.date <= date);
    const stats = deriveStats(windowRows);
    const { composite } = computeBurnout(stats);
    return { date, composite };
  });

  return points.reverse();
}
