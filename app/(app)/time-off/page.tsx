import { PageHead } from "@/components/ui/PageHead";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getVisiblePtoRequests } from "@/lib/supabase/attendance";
import { TimeOffClient } from "./TimeOffClient";

export default async function TimeOffPage() {
  const [requests, currentEmployeeId] = await Promise.all([getVisiblePtoRequests(), getCurrentEmployeeId()]);

  const mine = requests.filter((r) => r.employeeId === currentEmployeeId);
  // Anything RLS returned that ISN'T mine is, by construction, a row a
  // manager or HR can see because they manage that person or run the org
  // (0012's can_see_employee scoping) — a plain employee's own query never
  // gets these back at all, so no extra role check is needed here.
  const pendingForOthers = requests.filter((r) => r.employeeId !== currentEmployeeId && r.status === "pending");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHead title="Time Off" description="Request PTO and track approvals — vacation, sick, personal, or mental health days." />
      <TimeOffClient mine={mine} pendingForOthers={pendingForOthers} />
    </div>
  );
}
