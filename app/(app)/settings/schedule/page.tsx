import { PageHead } from "@/components/ui/PageHead";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getMySettings } from "@/lib/supabase/notifications";
import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return null;

  const { schedule, prefs } = await getMySettings(employeeId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHead
        title="Working Hours & Notifications"
        description="What counts as your working hours, and how notifications reach you outside them."
      />
      <ScheduleClient schedule={schedule} prefs={prefs} />
    </div>
  );
}
