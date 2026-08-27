import { getUpcomingMeetingHours } from "@/lib/supabase/meetings";
import { getUpcomingDueTaskCounts } from "@/lib/supabase/tasks";
import { getVisiblePtoRequests } from "@/lib/supabase/attendance";
import { forecastNext7Days, type ForecastPoint } from "@/lib/forecast";
import { todayInTz, addDays, isWithin } from "@/lib/date";
import type { BurnoutInputs } from "@/lib/burnout";
import type { BurnoutV2Extras } from "@/lib/burnout-signals";

/**
 * The forward-looking half of the forecast pipeline: given employees whose
 * v2 inputs/extras the caller has already built (buildBurnoutV2 — every
 * caller needs its own attendance/task signals fetch to get there, so that
 * part can't be shared), fetch each person's upcoming meetings, due tasks,
 * and approved PTO, and run forecastNext7Days.
 *
 * Both app/(app)/burnout/page.tsx (every visible employee) and
 * app/(app)/dashboard/page.tsx (top 3 flagged) need exactly this — the
 * same reasoning buildBurnoutV2 itself documents: two screens hand-
 * assembling the same forward-looking fetch is how they'd silently drift.
 */
export async function getForecastsForEmployees(
  employeeIds: string[],
  timezoneByEmployee: Map<string, string>,
  capacityByEmployee: Map<string, number>,
  inputsExtrasByEmployee: Map<string, { inputs: BurnoutInputs; extras: BurnoutV2Extras }>
): Promise<Record<string, ForecastPoint[]>> {
  if (employeeIds.length === 0) return {};

  const ptoRequests = await getVisiblePtoRequests();
  const approvedPtoByEmployee = new Map<string, { startDate: string; endDate: string }[]>();
  for (const req of ptoRequests) {
    if (req.status !== "approved") continue;
    const list = approvedPtoByEmployee.get(req.employeeId) ?? [];
    list.push({ startDate: req.startDate, endDate: req.endDate });
    approvedPtoByEmployee.set(req.employeeId, list);
  }

  const entries = await Promise.all(
    employeeIds.map(async (employeeId): Promise<[string, ForecastPoint[]] | null> => {
      const inputsExtras = inputsExtrasByEmployee.get(employeeId);
      if (!inputsExtras) return null;

      const timezone = timezoneByEmployee.get(employeeId) ?? "Asia/Manila";
      const employeeToday = todayInTz(timezone);
      const weeklyCapacityHours = capacityByEmployee.get(employeeId) ?? 40;

      const [meetingHours, dueTasks] = await Promise.all([
        getUpcomingMeetingHours(employeeId, timezone),
        getUpcomingDueTaskCounts(employeeId, employeeToday),
      ]);

      const ranges = approvedPtoByEmployee.get(employeeId) ?? [];
      const ptoScheduled = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(employeeToday, i + 1);
        return ranges.some((r) => isWithin(date, r.startDate, r.endDate));
      });

      const forecast = forecastNext7Days({
        inputs: inputsExtras.inputs,
        extras: inputsExtras.extras,
        upcomingMeetingHours: meetingHours,
        upcomingDueTasks: dueTasks,
        ptoScheduled,
        weeklyCapacityHours,
      });
      return [employeeId, forecast];
    })
  );

  return Object.fromEntries(entries.filter((e): e is [string, ForecastPoint[]] => e !== null));
}
