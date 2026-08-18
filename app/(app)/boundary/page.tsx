import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { BoundaryClient } from "./BoundaryClient";
import type { ActivityEntry, BoundaryStatus } from "@/types/boundary";

export default async function BoundaryPage() {
  const employees = await getEmployees();
  const currentEmployeeId = await getCurrentEmployeeId();

  const supabase = await createClient();
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
        description="Compose a message that lands inside someone's working hours."
      />
      <BoundaryClient
        employees={employees}
        currentEmployeeId={currentEmployeeId}
        initialActivity={initialActivity}
      />
    </div>
  );
}
