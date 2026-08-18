import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { KUDOS_PROGRESS_CAP, KUDOS_PROGRESS_START } from "@/lib/constants";
import { KudosClient, type HrViewItem } from "./KudosClient";

export default async function KudosPage() {
  const supabase = await createClient();
  const employees = await getEmployees();
  const buddy = employees.find((e) => e.name === "Beatriz Haddad") ?? employees[1];
  const employeeId = await getCurrentEmployeeId();

  let alreadySubmitted = false;
  let progress = KUDOS_PROGRESS_START;

  if (employeeId) {
    const { data: existing } = await supabase
      .from("kudos")
      .select("id")
      .eq("from_employee_id", employeeId)
      .eq("to_employee_id", buddy.id)
      .maybeSingle();
    alreadySubmitted = !!existing;

    const { count } = await supabase
      .from("kudos")
      .select("id", { count: "exact", head: true })
      .eq("from_employee_id", employeeId);
    progress = Math.min(KUDOS_PROGRESS_CAP, KUDOS_PROGRESS_START + (count ?? 0));
  }

  const { data: flaggedRows } = await supabase
    .from("kudos")
    .select("message, to_employee_id")
    .eq("flagged", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const hrView: HrViewItem[] = (flaggedRows ?? []).map((row) => {
    const recipient = employees.find((e) => e.id === row.to_employee_id);
    return {
      team: recipient?.team ?? "Unknown",
      note: (row.message as string) || "(no note)",
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#87D380" }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#2A7A26" }}>
          Link · Pillar 5
        </span>
      </div>
      <PageHead title="Give Me a Coffee" description="Send your buddy a quick note of thanks." />
      <KudosClient
        buddy={buddy}
        alreadySubmitted={alreadySubmitted}
        initialProgress={progress}
        hrView={hrView}
      />
    </div>
  );
}
