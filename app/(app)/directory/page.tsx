import { PageHead } from "@/components/ui/PageHead";
import { getEmployees } from "@/lib/supabase/queries";
import { getVisibleEmployees, getCurrentPerson, getTeams } from "@/lib/supabase/people";
import { getAttendanceSignals } from "@/lib/supabase/attendance";
import { getTaskBurnoutSignals } from "@/lib/supabase/tasks";
import { buildBurnoutV2 } from "@/lib/burnout-signals";
import { todayInTz } from "@/lib/date";
import { canSee } from "@/lib/authz";
import type { BurnoutBand } from "@/types/burnout";
import { DirectoryClient } from "./DirectoryClient";

/** Same buildBurnoutV2 pipeline /burnout and /insights use (see
 *  lib/burnout-signals.ts's own docstring on why every caller shares it) —
 *  Directory used to group by the legacy base composite instead, which
 *  disagreed with the Burnout Risk Analytics page's counts for the same
 *  people. */
export default async function DirectoryPage() {
  const [employees, people, currentPerson, teams] = await Promise.all([
    getEmployees(),
    getVisibleEmployees(),
    getCurrentPerson(),
    getTeams(),
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

  /**
   * Which people's burnout band this viewer may see.
   *
   * Directory used to render a band chip on all 28 cards for everyone, while
   * /burnout correctly scopes to self and /mood refuses to show a team
   * average until three people have checked in. A per-person band is not an
   * aggregate — it is an individual wellbeing signal attached to a named
   * colleague — so Directory was the one screen contradicting the stance the
   * rest of the product takes. `getVisibleEmployees()` above is not that
   * gate, despite the name: it relies entirely on `employees`' own RLS
   * policy, which is an org-wide read — it does not scope per viewer.
   *
   * Decided server-side and passed down as a set of ids: the client
   * component still receives every band (it needs them to build the
   * shelves — see DirectoryClient's own comment), but only renders the real
   * one for an id in this set. Everyone else's card falls back to an
   * "Unrated" shelf with no band shown, rather than being dropped from the
   * directory entirely. This is UI gating, not the security boundary — RLS
   * remains that — but the data here is already readable, so this is the
   * layer that decides what's drawn.
   *
   * Employee carries a team *name* and no teamId, so the id is resolved by
   * name rather than widening the type. getCurrentPerson is already called
   * in the app layout and is cache()-wrapped, so only getTeams costs an
   * extra round trip on this route.
   */
  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
  const bandVisibleIds = currentPerson
    ? new Set(
        employees
          .filter((e) => canSee(currentPerson, { id: e.id, teamId: teamIdByName.get(e.team) ?? null }, teams))
          .map((e) => e.id)
      )
    : new Set<string>();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHead
        title="Directory"
        description={`${employees.length} people across ${teamCount} teams`}
      />
      <DirectoryClient employees={employees} bandByEmployee={bandByEmployee} bandVisibleIds={bandVisibleIds} />
    </div>
  );
}
