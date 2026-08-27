import { PageHead } from "@/components/ui/PageHead";
import { getEmployees, getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getVisibleEmployees, getCurrentPerson } from "@/lib/supabase/people";
import { getOpenFocusSession, getTodayTimelines, getDueTodayCounts } from "@/lib/supabase/focus";
import { todayInTz } from "@/lib/date";
import { FocusClient } from "./FocusClient";

export default async function FocusPage() {
  const [employees, people, currentEmployeeId, currentPerson] = await Promise.all([
    getEmployees(),
    getVisibleEmployees(),
    getCurrentEmployeeId(),
    getCurrentPerson(),
  ]);

  const timezoneByEmployee = new Map(people.map((p) => [p.id, p.timezone]));
  const today = todayInTz(currentPerson?.timezone);
  const employeeIds = employees.map((e) => e.id);

  const [timelines, dueTodayCounts, openSession] = await Promise.all([
    getTodayTimelines(employeeIds, timezoneByEmployee, today),
    getDueTodayCounts(employeeIds, today),
    currentEmployeeId ? getOpenFocusSession(currentEmployeeId) : Promise.resolve(null),
  ]);

  const timelineByEmployee = Object.fromEntries(timelines);
  const dueTodayByEmployee = Object.fromEntries(dueTodayCounts);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#87CEEB" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#3B8FB0" }}>
          Adapt · Pillar 6
        </span>
      </div>
      <PageHead
        title="Focus Mode"
        description="Adapt the workspace to how stretched someone currently is — from real clocked hours and today's task load."
      />
      <FocusClient
        employees={employees}
        currentEmployeeId={currentEmployeeId}
        timelineByEmployee={timelineByEmployee}
        dueTodayByEmployee={dueTodayByEmployee}
        openSession={openSession}
      />
    </div>
  );
}
