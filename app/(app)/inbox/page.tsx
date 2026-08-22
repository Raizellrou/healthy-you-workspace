import { PageHead } from "@/components/ui/PageHead";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getInboxNotifications } from "@/lib/supabase/notifications";
import { sweepDueSoon } from "@/lib/notify";
import { InboxClient } from "./InboxClient";

export default async function InboxPage() {
  const [employeeId, person] = await Promise.all([getCurrentEmployeeId(), getCurrentPerson()]);
  if (!employeeId) return null;

  // Computed at read time, not by a background job — see lib/notify.ts#sweepDueSoon.
  await sweepDueSoon(employeeId, person?.timezone);
  const notifications = await getInboxNotifications(employeeId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHead title="Inbox" description="Task assignments, mentions, PTO decisions, and due-soon reminders." />
      <InboxClient notifications={notifications} />
    </div>
  );
}
