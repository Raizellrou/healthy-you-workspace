import { getEmployees } from "@/lib/supabase/queries";
import { getVisibleEmployees, getTeams } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals } from "@/lib/supabase/tasks";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { visibleTo } from "@/lib/authz";
import { todayInTz } from "@/lib/date";
import type { Person } from "@/types/person";

/**
 * Whether `viewer` would see at least one critical-band person on /burnout
 * right now — same visibleTo scoping and the same task-aware bandV2 scoring
 * that page itself uses, so the nav's "needs attention" dot can never
 * disagree with what opening the page actually shows.
 *
 * Deliberately not the frozen lib/burnout.ts#computeBurnout the nav dot used
 * before: that base method ignores real attendance/task signals (so it can
 * flag someone bandV2 doesn't) and was being run over every employee
 * org-wide instead of this viewer's visible set (so it could also flag
 * someone this viewer can't even see on the page).
 */
export async function hasCriticalBurnout(viewer: Person | null): Promise<boolean> {
  if (!viewer) return false;

  const [employees, people, teams] = await Promise.all([getEmployees(), getVisibleEmployees(), getTeams()]);
  const visiblePeople = visibleTo(viewer, people, (p) => p, teams);
  const visibleIds = new Set(visiblePeople.map((p) => p.id));
  const capacityByEmployee = new Map(visiblePeople.map((p) => [p.id, p.weeklyCapacityHours]));
  const timezoneByEmployee = new Map(visiblePeople.map((p) => [p.id, p.timezone]));
  const today = todayInTz(viewer.timezone);

  const visibleEmployees = employees.filter((e) => visibleIds.has(e.id));
  const employeeIds = visibleEmployees.map((e) => e.id);

  const [attendanceSignals, taskSignals] = await Promise.all([
    getAttendanceSignals(employeeIds, timezoneByEmployee, today),
    getTaskBurnoutSignals(employeeIds, today),
  ]);

  return visibleEmployees.some((employee) => {
    const weeklyCapacityHours = capacityByEmployee.get(employee.id) ?? 40;
    const { scores } = buildBurnoutV2(
      employee,
      attendanceSignals.get(employee.id),
      taskSignals.get(employee.id),
      weeklyCapacityHours
    );
    return scores.bandV2 === "critical";
  });
}
