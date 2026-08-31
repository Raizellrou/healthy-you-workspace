import { PageHead } from "@/components/ui/PageHead";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { isHr as isHrRole } from "@/lib/authz";
import { KUDOS_PROGRESS_CAP } from "@/lib/constants";
import { KudosClient, type HrViewItem, type ConcernItem } from "./KudosClient";

export default async function KudosPage() {
  const supabase = await createClient();
  const employees = await getEmployees();
  const employeeId = await getCurrentEmployeeId();
  const currentPerson = await getCurrentPerson();
  const isHr = currentPerson ? isHrRole(currentPerson.appRole) : false;

  let buddy = null as (typeof employees)[number] | null;
  let alreadySubmitted = false;
  let progress = 0;

  if (employeeId) {
    const { data: pairingRows } = await supabase
      .from("buddy_pairings")
      .select("week_start, employee_a, employee_b")
      .or(`employee_a.eq.${employeeId},employee_b.eq.${employeeId}`)
      .order("week_start", { ascending: false })
      .limit(1);
    const pairing = pairingRows?.[0];
    if (pairing) {
      const buddyId = pairing.employee_a === employeeId ? pairing.employee_b : pairing.employee_a;
      buddy = employees.find((e) => e.id === buddyId) ?? null;
    }

    if (buddy) {
      const { data: existing } = await supabase
        .from("kudos")
        .select("id")
        .eq("from_employee_id", employeeId)
        .eq("to_employee_id", buddy.id)
        .maybeSingle();
      alreadySubmitted = !!existing;
    }

    const { count } = await supabase
      .from("kudos")
      .select("id", { count: "exact", head: true })
      .eq("from_employee_id", employeeId);
    progress = Math.min(KUDOS_PROGRESS_CAP, count ?? 0);
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

  let concerns: ConcernItem[] = [];
  if (isHr) {
    const { data } = await supabase
      .from("concern_flags")
      .select("id, about_employee_id, category, note, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    concerns = (data ?? []).map((row) => ({
      id: row.id as string,
      aboutName: employees.find((e) => e.id === row.about_employee_id)?.name ?? "Unknown",
      category: row.category as string,
      note: row.note as string,
      status: row.status as "open" | "acknowledged" | "resolved",
      createdAt: row.created_at as string,
    }));
  }

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
        isHr={isHr}
        concerns={concerns}
        employees={employees}
        currentEmployeeId={employeeId}
      />
    </div>
  );
}
