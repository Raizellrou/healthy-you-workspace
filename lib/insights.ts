import { daysBetween, eachDay, isWeekend, type IsoDate } from "@/lib/date";
import type { BurnoutBand } from "@/types/burnout";

/**
 * P8: the org-analytics aggregations behind /insights. Pure and unit-tested,
 * matching lib/attendance.ts and lib/tasks.ts — every fetch lives in
 * lib/supabase/insights.ts, every calculation lives here.
 *
 * Nothing here invents a number. Each function is a roll-up of rows that some
 * other pillar already writes for its own reasons: burnout bands from the
 * scoring pipeline, PTO from approved requests, recognition from kudos. The
 * screen's value is the altitude, not new math.
 */

export const BANDS: BurnoutBand[] = ["low", "medium", "high", "critical"];

export interface TeamBandRow {
  employeeId: string;
  team: string;
  band: BurnoutBand;
  score: number;
}

export interface TeamBandDistribution {
  team: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
  /** Mean task-aware composite for the team, rounded. */
  avgScore: number;
  /** high + critical — the number the header tile leads with. */
  atRisk: number;
}

/** Band composition per team, worst-first so the team needing attention is
 *  the first row rather than an alphabetical accident. */
export function bandDistributionByTeam(rows: TeamBandRow[]): TeamBandDistribution[] {
  const byTeam = new Map<string, TeamBandRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.team) ?? [];
    list.push(row);
    byTeam.set(row.team, list);
  }

  return [...byTeam.entries()]
    .map(([team, members]) => {
      const counts: Record<BurnoutBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      let scoreTotal = 0;
      for (const m of members) {
        counts[m.band]++;
        scoreTotal += m.score;
      }
      return {
        team,
        ...counts,
        total: members.length,
        avgScore: Math.round(scoreTotal / members.length),
        atRisk: counts.high + counts.critical,
      };
    })
    .sort((a, b) => b.atRisk - a.atRisk || b.avgScore - a.avgScore || a.team.localeCompare(b.team));
}

export interface TeamCapacityInput {
  employeeId: string;
  team: string;
  loadPct: number;
}

export interface TeamCapacity {
  team: string;
  avgLoadPct: number;
  memberCount: number;
  overCapacityCount: number;
}

/** Mean committed-load percentage per team. Deliberately a different
 *  altitude from /tasks/workload's per-person bars — this answers "which
 *  team is structurally overcommitted", not "who is". */
export function capacityByTeam(rows: TeamCapacityInput[]): TeamCapacity[] {
  const byTeam = new Map<string, TeamCapacityInput[]>();
  for (const row of rows) {
    const list = byTeam.get(row.team) ?? [];
    list.push(row);
    byTeam.set(row.team, list);
  }

  return [...byTeam.entries()]
    .map(([team, members]) => ({
      team,
      avgLoadPct: Math.round(members.reduce((s, m) => s + m.loadPct, 0) / members.length),
      memberCount: members.length,
      overCapacityCount: members.filter((m) => m.loadPct > 100).length,
    }))
    .sort((a, b) => b.avgLoadPct - a.avgLoadPct || a.team.localeCompare(b.team));
}

export interface PtoRowInput {
  employeeId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: string;
}

export interface PtoUtilization {
  /** Approved weekdays taken across the window, org-wide. */
  totalDays: number;
  /** People who took at least one approved PTO weekday in the window. */
  peopleWithPto: number;
  headcount: number;
  /** Mean approved weekdays per person, one decimal. */
  avgDaysPerPerson: number;
  byTeam: { team: string; days: number; memberCount: number }[];
}

/**
 * Weekdays only — a Fri–Mon request is 2 days off, not 4, and counting the
 * weekend would quietly inflate every utilization number. Days outside
 * [windowStart, windowEnd] are clipped rather than dropped, so a request
 * straddling the boundary contributes only its in-window portion.
 */
export function ptoUtilization(
  rows: PtoRowInput[],
  people: { id: string; team: string }[],
  windowStart: IsoDate,
  windowEnd: IsoDate
): PtoUtilization {
  const teamById = new Map(people.map((p) => [p.id, p.team]));
  const daysByEmployee = new Map<string, number>();

  for (const row of rows) {
    if (row.status !== "approved") continue;
    if (row.endDate < windowStart || row.startDate > windowEnd) continue;
    const from = row.startDate < windowStart ? windowStart : row.startDate;
    const to = row.endDate > windowEnd ? windowEnd : row.endDate;
    if (daysBetween(from, to) < 0) continue;
    const weekdays = eachDay(from, to).filter((d) => !isWeekend(d)).length;
    daysByEmployee.set(row.employeeId, (daysByEmployee.get(row.employeeId) ?? 0) + weekdays);
  }

  const byTeamDays = new Map<string, number>();
  const byTeamMembers = new Map<string, number>();
  for (const person of people) {
    byTeamMembers.set(person.team, (byTeamMembers.get(person.team) ?? 0) + 1);
    byTeamDays.set(person.team, (byTeamDays.get(person.team) ?? 0) + (daysByEmployee.get(person.id) ?? 0));
  }

  const totalDays = [...daysByEmployee.values()].reduce((s, d) => s + d, 0);
  const peopleWithPto = [...daysByEmployee.entries()].filter(([id, d]) => d > 0 && teamById.has(id)).length;

  return {
    totalDays,
    peopleWithPto,
    headcount: people.length,
    avgDaysPerPerson: people.length === 0 ? 0 : Math.round((totalDays / people.length) * 10) / 10,
    byTeam: [...byTeamMembers.entries()]
      .map(([team, memberCount]) => ({ team, days: byTeamDays.get(team) ?? 0, memberCount }))
      .sort((a, b) => a.days - b.days || a.team.localeCompare(b.team)),
  };
}

export interface KudosRowInput {
  toEmployeeId: string | null;
  createdAt: string;
}

export interface RecognitionCoverage {
  /** People who received at least one kudos inside the window. */
  coveredCount: number;
  headcount: number;
  coveragePct: number;
  /** The "recognition drought" signal: nobody has thanked these people
   *  inside the window. Sorted by name so the list is stable across loads. */
  drought: RecognitionPerson[];
}

export interface RecognitionPerson {
  id: string;
  name: string;
  team: string;
  avatarColor: string;
}

/**
 * Recognition coverage and its inverse, the drought list. The drought half
 * is the point: an org-wide kudos *count* looks healthy while the same
 * three extroverts collect all of it, and only a per-person coverage check
 * surfaces the people nobody has thanked.
 */
export function recognitionCoverage(
  kudos: KudosRowInput[],
  people: RecognitionPerson[],
  windowStartIso: string
): RecognitionCoverage {
  const recognized = new Set<string>();
  for (const k of kudos) {
    if (!k.toEmployeeId) continue;
    if (k.createdAt < windowStartIso) continue;
    recognized.add(k.toEmployeeId);
  }

  const drought = people
    .filter((p) => !recognized.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const coveredCount = people.filter((p) => recognized.has(p.id)).length;

  return {
    coveredCount,
    headcount: people.length,
    coveragePct: people.length === 0 ? 0 : Math.round((coveredCount / people.length) * 100),
    drought,
  };
}

export interface OffHoursIndex {
  offHoursEvents: number;
  totalEvents: number;
  /** Share of task activity that happened outside working hours, 0–100. */
  ratePct: number;
}

/** Off-hours index from the task_events audit log — real timestamps of real
 *  work, already stamped with is_off_hours in the actor's own timezone by
 *  app/(app)/tasks/actions.ts#recordEvent. */
export function offHoursIndex(events: { isOffHours: boolean }[]): OffHoursIndex {
  const totalEvents = events.length;
  const offHoursEvents = events.filter((e) => e.isOffHours).length;
  return {
    offHoursEvents,
    totalEvents,
    ratePct: totalEvents === 0 ? 0 : Math.round((offHoursEvents / totalEvents) * 100),
  };
}

export interface HoldBreakdown {
  reason: string;
  label: string;
  count: number;
}

export interface NotificationHoldRate {
  total: number;
  held: number;
  heldPct: number;
  breakdown: HoldBreakdown[];
}

const HOLD_LABELS: Record<string, string> = {
  quiet_hours: "Quiet hours",
  batched: "Batched",
  focus_session: "Focus session",
  delivered: "Delivered immediately",
};

/**
 * How often the P6 notification funnel actually held something back. This is
 * the one number that proves right-to-disconnect is a working mechanism
 * rather than a settings screen nobody's preferences reach.
 */
export function notificationHoldRate(rows: { heldReason: string; count: number }[]): NotificationHoldRate {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const held = rows.filter((r) => r.heldReason !== "delivered").reduce((s, r) => s + r.count, 0);
  return {
    total,
    held,
    heldPct: total === 0 ? 0 : Math.round((held / total) * 100),
    breakdown: rows
      .map((r) => ({ reason: r.heldReason, label: HOLD_LABELS[r.heldReason] ?? r.heldReason, count: r.count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Below this many paired data points, a Pearson coefficient swings too
 *  wildly on one extra point to mean anything — the 0028_correlations.sql
 *  RPCs return whatever count() they found regardless, so the UI has to be
 *  the thing that decides "too little to read a correlation from". */
export const MIN_CORRELATION_SAMPLE = 10;

/** Rough-magnitude label for a Pearson r, in plain words — nobody reading a
 *  dashboard card should have to remember what 0.3 versus 0.6 means. */
export function describeCorrelation(r: number): string {
  const magnitude = Math.abs(r);
  if (magnitude < 0.1) return "no real relationship";
  const strength = magnitude >= 0.5 ? "strong" : magnitude >= 0.3 ? "moderate" : "weak";
  return `${strength} ${r > 0 ? "positive" : "negative"} relationship`;
}
