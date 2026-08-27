import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { DEFAULT_QUIET_START_MIN, DEFAULT_QUIET_END_MIN, type WorkSchedule } from "@/lib/schedule";
import { DEFAULT_TIMEZONE } from "@/lib/date";
import { BoundaryClient, type RecipientAvailability } from "./BoundaryClient";
import type { ActivityEntry, BoundaryStatus } from "@/types/boundary";

interface AvailabilityRow {
  timezone: string;
  workdays: number[];
  start_min: number;
  end_min: number;
  on_pto: boolean;
  pto_return_date: string | null;
}

export default async function BoundaryPage() {
  const employees = await getEmployees();
  const currentEmployeeId = await getCurrentEmployeeId();
  const currentPerson = await getCurrentPerson();

  const supabase = await createClient();

  // Fetched once here (not on every slider tick) so BoundaryClient's live
  // preview stays instant and fully client-side, the same UX the old
  // abstract-index version had — evaluateBoundaryV2 is pure, so handing it
  // every recipient's real schedule/PTO status up front is all a client
  // component needs. Direct work_schedules/pto_requests reads would be
  // RLS-blocked for anyone but self (0014/0012 are self- and
  // can_see_employee-scoped), so this goes through the security definer
  // get_recipient_availability() (0016) instead — one call per employee,
  // bounded by headcount, same pattern as the RLS-anon-key philosophy this
  // project already follows elsewhere.
  const availabilityEntries = await Promise.all(
    employees.map(async (e) => {
      const { data } = await supabase
        .rpc("get_recipient_availability", { target_employee_id: e.id })
        .maybeSingle<AvailabilityRow>();
      const schedule: WorkSchedule = data
        ? {
            timezone: data.timezone,
            workdays: data.workdays as WorkSchedule["workdays"],
            startMin: data.start_min,
            endMin: data.end_min,
            quietStartMin: DEFAULT_QUIET_START_MIN,
            quietEndMin: DEFAULT_QUIET_END_MIN,
          }
        : {
            timezone: DEFAULT_TIMEZONE,
            workdays: [1, 2, 3, 4, 5],
            startMin: 9 * 60,
            endMin: 18 * 60,
            quietStartMin: DEFAULT_QUIET_START_MIN,
            quietEndMin: DEFAULT_QUIET_END_MIN,
          };
      const availability: RecipientAvailability = {
        schedule,
        onPto: data?.on_pto ?? false,
        returnDate: data?.pto_return_date ?? null,
      };
      return [e.id, availability] as const;
    })
  );
  const availabilityByEmployee = Object.fromEntries(availabilityEntries);

  let initialActivity: ActivityEntry[] = [];
  if (currentEmployeeId) {
    const { data } = await supabase
      .from("boundary_events")
      .select("id, message_preview, action, sent_at, scheduled_delivery")
      .eq("sender_id", currentEmployeeId)
      .order("sent_at", { ascending: false })
      .limit(10);

    const FALLBACK_MESSAGE: Record<BoundaryStatus, string> = {
      blocked: "Blocked",
      warned: "Warned before sending",
      delivered: "Delivered immediately",
      delayed: "Held for working hours",
    };

    initialActivity = (data ?? []).map((row) => {
      const status = row.action as BoundaryStatus;
      const scheduledDelivery = row.scheduled_delivery as string | null;
      const message =
        status === "delayed" && scheduledDelivery
          ? `Held until ${new Date(scheduledDelivery).toLocaleString(undefined, {
              weekday: "long",
              hour: "numeric",
              minute: "2-digit",
            })}`
          : FALLBACK_MESSAGE[status];
      return {
        id: row.id as string,
        preview: row.message_preview as string,
        status,
        message,
        timestamp: new Date(row.sent_at as string).getTime(),
      };
    });
  }

  let offHoursByTeam: { team: string; totalSent: number; delayedCount: number }[] = [];
  if (currentPerson?.appRole === "hr") {
    const { data } = await supabase.rpc("get_boundary_offhours_rate", { days: 30 });
    offHoursByTeam = (data ?? []).map((row: { team: string; total_sent: number; delayed_count: number }) => ({
      team: row.team,
      totalSent: row.total_sent,
      delayedCount: row.delayed_count,
    }));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#A8D592" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#6B9459" }}>
          Anchor · Pillar 4
        </span>
      </div>
      <PageHead
        title="Right to Disconnect"
        description="Compose a message that lands inside someone's real working hours."
      />
      <BoundaryClient
        employees={employees}
        currentEmployeeId={currentEmployeeId}
        initialActivity={initialActivity}
        availabilityByEmployee={availabilityByEmployee}
        offHoursByTeam={offHoursByTeam}
      />
    </div>
  );
}
