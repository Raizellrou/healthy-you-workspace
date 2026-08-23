import { PageHead } from "@/components/ui/PageHead";
import { getEmployees, getBurnoutHistory } from "@/lib/supabase/queries";
import { getCurrentPerson, getVisibleEmployees, getTeams } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals } from "@/lib/supabase/tasks";
import { buildBurnoutV2, type BurnoutV2Extras, type BurnoutV2Scores } from "@/lib/burnout-signals";
import { visibleTo, isHr, isManagerOf } from "@/lib/authz";
import { todayInTz } from "@/lib/date";
import { getInterventionsForEmployees, type Intervention } from "@/lib/supabase/interventions";
import { BurnoutClient } from "./BurnoutClient";
import type { Employee } from "@/types/employee";
import type { BurnoutInputs } from "@/lib/burnout";

export interface BurnoutRow {
  employee: Employee;
  scores: BurnoutV2Scores;
  /** The exact inputs/extras that produced `scores` — carried down to the
   *  client so the P8 what-if simulator (components/burnout/WhatIfSimulator.tsx)
   *  can re-run computeBurnoutV2 against a perturbed copy without a round trip. */
  inputs: BurnoutInputs;
  extras: BurnoutV2Extras;
  /** The intervention engine's authorization, precomputed server-side the
   *  same way `visibleTo` scoping already is — the client never re-derives
   *  a permission decision, it just renders what it's told. */
  canManage: boolean;
  isSelf: boolean;
  latestIntervention: Intervention | null;
}

export default async function BurnoutPage() {
  const [employees, currentPerson, people, teams] = await Promise.all([
    getEmployees(),
    getCurrentPerson(),
    getVisibleEmployees(),
    getTeams(),
  ]);

  // Same roster-scoping fix as the attendance page: `employees` SELECT is
  // org-wide by design (Directory), so the RLS-level scoping this screen
  // needs — self/team/org — comes from the pure `visibleTo` mirror, not
  // from the query itself.
  const visiblePeople = currentPerson ? visibleTo(currentPerson, people, (p) => p, teams) : [];
  const visibleIds = new Set(visiblePeople.map((p) => p.id));
  const capacityByEmployee = new Map(visiblePeople.map((p) => [p.id, p.weeklyCapacityHours]));
  const timezoneByEmployee = new Map(visiblePeople.map((p) => [p.id, p.timezone]));
  const today = todayInTz(currentPerson?.timezone);

  const visibleEmployees = employees.filter((e) => visibleIds.has(e.id));
  const employeeIds = visibleEmployees.map((e) => e.id);

  const [attendanceSignals, taskSignals, histories, interventionsByEmployee] = await Promise.all([
    getAttendanceSignals(employeeIds, timezoneByEmployee, today),
    getTaskBurnoutSignals(employeeIds, today),
    Promise.all(visibleEmployees.map((e) => getBurnoutHistory(e.id))),
    getInterventionsForEmployees(employeeIds),
  ]);
  const historyByEmployee = Object.fromEntries(visibleEmployees.map((e, i) => [e.id, histories[i]]));

  const rows: BurnoutRow[] = visibleEmployees.map((employee) => {
    const attendance = attendanceSignals.get(employee.id);
    const tasks = taskSignals.get(employee.id);
    const weeklyCapacityHours = capacityByEmployee.get(employee.id) ?? 40;

    const { inputs, extras, scores } = buildBurnoutV2(employee, attendance, tasks, weeklyCapacityHours);

    const person = visiblePeople.find((p) => p.id === employee.id);
    const canManage = !!currentPerson && !!person && (isHr(currentPerson.appRole) || isManagerOf(currentPerson, person, teams));
    const isSelf = currentPerson?.id === employee.id;
    const latestIntervention = interventionsByEmployee.get(employee.id)?.[0] ?? null;

    return { employee, scores, inputs, extras, canManage, isSelf, latestIntervention };
  });

  const avgScore = rows.length === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.scores.compositeV2, 0) / rows.length);
  const criticalCount = rows.filter((r) => r.scores.bandV2 === "critical").length;
  const highCount = rows.filter((r) => r.scores.bandV2 === "high").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#6F49A6" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6F49A6" }}>
          Predict · Pillar 1
        </span>
      </div>
      <PageHead
        title="Burnout Risk Analytics"
        description="Task-aware composite: work streak, meeting load, off-hours activity, and time since PTO — plus real committed task load, overdue tasks, and recovery time."
        actions={
          <div className="flex gap-2">
            {[
              { label: "Avg score", value: avgScore, color: "#6F49A6" },
              { label: "Critical", value: criticalCount, color: "#FF8C73" },
              { label: "High risk", value: highCount, color: "#FFD700" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-center">
                <div className="text-lg font-bold leading-tight" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-[10px] text-ink-mute">{s.label}</div>
              </div>
            ))}
          </div>
        }
      />
      <BurnoutClient rows={rows} historyByEmployee={historyByEmployee} />
    </div>
  );
}
