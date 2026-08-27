import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/supabase/queries";
import { getOpenSession } from "@/lib/supabase/attendance";
import { NudgesClient } from "./NudgesClient";

export default async function NudgesPage() {
  const employeeId = await getCurrentEmployeeId();
  const openSession = employeeId ? await getOpenSession(employeeId) : null;

  // A real, data-driven nudge: minutes clocked in with zero breaks taken
  // yet this session — the frozen nudge-context.tsx simulation can't be
  // taught this (it's a closed client-side loop with no injection point),
  // so this is computed here and rendered as its own card instead.
  let noBreakMinutes: number | null = null;
  if (openSession && !openSession.openBreak) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("session_breaks")
      .select("id", { count: "exact", head: true })
      .eq("session_id", openSession.id);
    if (!count) {
      const now = new Date();
      noBreakMinutes = Math.floor((now.getTime() - new Date(openSession.clockIn).getTime()) / 60_000);
    }
  }

  return <NudgesClient noBreakMinutes={noBreakMinutes} />;
}
