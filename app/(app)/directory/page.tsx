import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { getVisibleEmployees, getCurrentPerson } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals } from "@/lib/supabase/tasks";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { todayInTz } from "@/lib/date";
import type { BurnoutBand } from "@/types/burnout";
import { DirectoryClient } from "./DirectoryClient";

/** Same buildBurnoutV2 pipeline /burnout and /insights use (see
 *  lib/burnout-signals.ts's own docstring on why every caller shares it) —
 *  Directory used to group by the legacy base composite instead, which
 *  disagreed with the Burnout Risk Analytics page's counts for the same
 *  people. */
export default async function DirectoryPage() {
  const [employees, people, currentPerson] = await Promise.all([
    getEmployees(),
    getVisibleEmployees(),
    getCurrentPerson(),
  ]);
  const teamCount = new Set(employees.map((e) => e.team)).size;

  const today = todayInTz(currentPerson?.timezone);
  const employeeIds = employees.map((e) => e.id);
  const capacityByEmployee = new Map(people.map((p) => [p.id, p.weeklyCapacityHours]));
  const timezoneByEmployee = new Map(people.map((p) => [p.id, p.timezone]));

  const [attendanceSignals, taskSignals] = await Promise.all([
    getAttendanceSignals(employeeIds, timezoneByEmployee, today),
    getTaskBurnoutSignals(employeeIds, today),
  ]);

  const bandByEmployee: Record<string, BurnoutBand> = {};
  for (const employee of employees) {
    const { scores } = buildBurnoutV2(
      employee,
      attendanceSignals.get(employee.id),
      taskSignals.get(employee.id),
      capacityByEmployee.get(employee.id) ?? 40
    );
    bandByEmployee[employee.id] = scores.bandV2;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Directory"
        description={`${employees.length} people across ${teamCount} teams`}
      />
      <DirectoryClient employees={employees} bandByEmployee={bandByEmployee} />
    </div>
  );
}
