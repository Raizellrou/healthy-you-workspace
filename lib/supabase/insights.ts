import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/supabase/queries";
import { getVisibleEmployees } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals, getRebalanceCandidates } from "@/lib/supabase/tasks";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { capacityLoad } from "@/lib/tasks";
import { addDays, todayInTz, type IsoDate } from "@/lib/date";
import {
  bandDistributionByTeam,
  capacityByTeam,
  ptoUtilization,
  recognitionCoverage,
  offHoursIndex,
  notificationHoldRate,
  type TeamBandDistribution,
  type TeamBandRow,
  type TeamCapacity,
  type PtoUtilization,
  type RecognitionCoverage,
  type OffHoursIndex,
  type NotificationHoldRate,
} from "@/lib/insights";

/**
 * The /insights fetch layer. Every calculation lives in lib/insights.ts;
 * this module only fetches and hands rows over, matching
 * lib/supabase/attendance.ts's split.
 *
 * Scoping is RLS, not a filter here: an HR caller's `getVisibleEmployees()`
 * returns the org, so these aggregates cover the org. The page's own
 * `appRole !== "hr"` check produces a 404 for anyone else — but even without
 * it, a manager reaching this code would get their own team's numbers rather
 * than the org's, and the two RPCs that read past RLS (boundary, notification
 * holds) are themselves `where public.is_hr()`-gated.
 */

export interface OrgTrendPoint {
  day: IsoDate;
  avgMood: number | null;
  checkinCount: number;
}

export interface CorrelationStat {
  correlation: number | null;
  sampleSize: number;
  avgX: number | null;
  avgY: number | null;
}

export interface OrgInsights {
  headcount: number;
  today: IsoDate;
  windowDays: number;
  avgBurnout: number;
  atRiskCount: number;
  bandsByTeam: TeamBandDistribution[];
  capacity: TeamCapacity[];
  pto: PtoUtilization;
  recognition: RecognitionCoverage;
  offHours: OffHoursIndex;
  offHoursByTeam: { team: string; totalSent: number; delayedCount: number }[];
  holds: NotificationHoldRate;
  moodTrend: OrgTrendPoint[];
  meetingOffHoursCorr: CorrelationStat;
  offHoursMoodCorr: CorrelationStat;
}

const WINDOW_DAYS = 30;

export async function getOrgInsights(timezone?: string): Promise<OrgInsights> {
  const supabase = await createClient();
  const today = todayInTz(timezone);
  const windowStart = addDays(today, -WINDOW_DAYS);
  const windowStartIso = `${windowStart}T00:00:00.000Z`;

  const [employees, people, rebalance] = await Promise.all([
    getEmployees(),
    getVisibleEmployees(),
    getRebalanceCandidates(),
  ]);

  const visibleIds = new Set(people.map((p) => p.id));
  const visibleEmployees = employees.filter((e) => visibleIds.has(e.id));
  const employeeIds = visibleEmployees.map((e) => e.id);
  const teamById = new Map(people.map((p) => [p.id, p.team]));
  const capacityById = new Map(people.map((p) => [p.id, p.weeklyCapacityHours]));
  const timezoneById = new Map(people.map((p) => [p.id, p.timezone]));

  const [
    attendanceSignals,
    taskSignals,
    ptoRes,
    kudosRes,
    eventsRes,
    moodRes,
    boundaryRes,
    holdRes,
    meetingCorrRes,
    moodCorrRes,
  ] = await Promise.all([
    getAttendanceSignals(employeeIds, timezoneById, today),
    getTaskBurnoutSignals(employeeIds, today),
    supabase
      .from("pto_requests")
      .select("employee_id, start_date, end_date, status")
      .returns<{ employee_id: string; start_date: IsoDate; end_date: IsoDate; status: string }[]>(),
    supabase
      .from("kudos")
      .select("to_employee_id, created_at")
      .gte("created_at", windowStartIso)
      .returns<{ to_employee_id: string | null; created_at: string }[]>(),
    supabase
      .from("task_events")
      .select("is_off_hours")
      .gte("created_at", windowStartIso)
      .returns<{ is_off_hours: boolean }[]>(),
    supabase.rpc("get_org_mood_trend", { days: WINDOW_DAYS }),
    supabase.rpc("get_boundary_offhours_rate", { days: WINDOW_DAYS }),
    supabase.rpc("get_notification_hold_rate", { days: WINDOW_DAYS }),
    supabase.rpc("get_meeting_burnout_corr", { days: WINDOW_DAYS }),
    supabase.rpc("get_offhours_mood_corr", { days: WINDOW_DAYS }),
  ]);

  const bandRows: TeamBandRow[] = visibleEmployees.map((employee) => {
    const { scores } = buildBurnoutV2(
      employee,
      attendanceSignals.get(employee.id),
      taskSignals.get(employee.id),
      capacityById.get(employee.id) ?? 40
    );
    return {
      employeeId: employee.id,
      team: teamById.get(employee.id) ?? employee.team,
      band: scores.bandV2,
      score: scores.compositeV2,
    };
  });

  const bandsByTeam = bandDistributionByTeam(bandRows);
  const avgBurnout =
    bandRows.length === 0 ? 0 : Math.round(bandRows.reduce((s, r) => s + r.score, 0) / bandRows.length);
  const atRiskCount = bandRows.filter((r) => r.band === "high" || r.band === "critical").length;

  // Everyone gets a capacity row, including people with no open tasks — a
  // 0%-loaded person is real signal for a team average, and dropping them
  // would quietly inflate every team's number (the same filtered-entries
  // bug the rebalancer hit in P8 item 1).
  const capacity = capacityByTeam(
    people.map((p) => {
      const committed = rebalance.people.find((r) => r.employeeId === p.id)?.committedHours ?? 0;
      return {
        employeeId: p.id,
        team: p.team,
        loadPct: capacityLoad(committed, p.weeklyCapacityHours),
      };
    })
  );

  const roster = people.map((p) => ({ id: p.id, name: p.name, team: p.team, avatarColor: p.avatarColor }));

  return {
    headcount: people.length,
    today,
    windowDays: WINDOW_DAYS,
    avgBurnout,
    atRiskCount,
    bandsByTeam,
    capacity,
    pto: ptoUtilization(
      (ptoRes.data ?? []).map((r) => ({
        employeeId: r.employee_id,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
      })),
      roster,
      windowStart,
      today
    ),
    recognition: recognitionCoverage(
      (kudosRes.data ?? []).map((k) => ({ toEmployeeId: k.to_employee_id, createdAt: k.created_at })),
      roster,
      windowStartIso
    ),
    offHours: offHoursIndex((eventsRes.data ?? []).map((e) => ({ isOffHours: e.is_off_hours }))),
    offHoursByTeam: ((boundaryRes.data ?? []) as { team: string; total_sent: number; delayed_count: number }[]).map(
      (row) => ({ team: row.team, totalSent: row.total_sent, delayedCount: row.delayed_count })
    ),
    holds: notificationHoldRate(
      ((holdRes.data ?? []) as { held_reason: string; notification_count: number }[]).map((row) => ({
        heldReason: row.held_reason,
        count: row.notification_count,
      }))
    ),
    moodTrend: ((moodRes.data ?? []) as { day: string; avg_mood: number | null; checkin_count: number }[]).map(
      (row) => ({ day: row.day, avgMood: row.avg_mood, checkinCount: row.checkin_count })
    ),
    meetingOffHoursCorr: (() => {
      const row = (
        meetingCorrRes.data as
          | { correlation: number | null; sample_size: number; avg_meeting_hours: number | null; avg_off_hours_messages: number | null }[]
          | null
      )?.[0];
      return row
        ? { correlation: row.correlation, sampleSize: row.sample_size, avgX: row.avg_meeting_hours, avgY: row.avg_off_hours_messages }
        : { correlation: null, sampleSize: 0, avgX: null, avgY: null };
    })(),
    offHoursMoodCorr: (() => {
      const row = (
        moodCorrRes.data as
          | { correlation: number | null; sample_size: number; avg_off_hours_messages: number | null; avg_mood: number | null }[]
          | null
      )?.[0];
      return row
        ? { correlation: row.correlation, sampleSize: row.sample_size, avgX: row.avg_off_hours_messages, avgY: row.avg_mood }
        : { correlation: null, sampleSize: 0, avgX: null, avgY: null };
    })(),
  };
}
