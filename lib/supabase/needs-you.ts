import { createClient } from "@/lib/supabase/server";
import { getUnreadCount } from "@/lib/supabase/notifications";
import { getVisiblePtoRequests } from "@/lib/supabase/attendance";
import { getInterventionsForEmployees } from "@/lib/supabase/interventions";
import { getCurrentPulseQuestion, hasAnsweredPulse } from "@/lib/supabase/pulse";
import { todayInTz } from "@/lib/date";
import type { IconName } from "@/components/icons/Icon";
import type { Person } from "@/types/person";

/**
 * Phase 05 dashboard, Zone B — additive only, no change to any existing
 * query's signature. Each signal reuses an already-exported read; this
 * file's only new query is hasCheckedInMoodToday, which mood/page.tsx
 * previously inlined and nowhere else could reuse.
 */

export interface NeedsYouItem {
  icon: IconName;
  label: string;
  href: string;
}

/** Today's calendar day in the employee's own timezone — mirrors the
 *  mood_checkins.date convention lib/date.ts's header describes. */
export async function hasCheckedInMoodToday(employeeId: string, timezone: string): Promise<boolean> {
  const supabase = await createClient();
  const today = todayInTz(timezone);
  const { data } = await supabase
    .from("mood_checkins")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("date", today)
    .maybeSingle();
  return data !== null;
}

/** Things waiting on this specific person to act. Absent entirely — not a
 *  zero-count card — when nothing needs them; the dashboard drops the
 *  whole zone when this returns []. */
export async function getNeedsYou(me: Person): Promise<NeedsYouItem[]> {
  const items: NeedsYouItem[] = [];

  const [unreadInbox, ptoRequests, interventions, pulseQuestion] = await Promise.all([
    getUnreadCount(me.id),
    me.appRole === "manager" || me.appRole === "hr" ? getVisiblePtoRequests() : Promise.resolve([]),
    getInterventionsForEmployees([me.id]),
    getCurrentPulseQuestion(),
  ]);

  if (unreadInbox > 0) {
    items.push({
      icon: "inbox",
      label: `${unreadInbox} unread notification${unreadInbox === 1 ? "" : "s"}`,
      href: "/inbox",
    });
  }

  const pendingForOthers = ptoRequests.filter((r) => r.status === "pending" && r.employeeId !== me.id);
  if (pendingForOthers.length > 0) {
    items.push({
      icon: "timer",
      label: `${pendingForOthers.length} time-off request${pendingForOthers.length === 1 ? "" : "s"} to decide`,
      href: "/time-off",
    });
  }

  const openInterventions = (interventions.get(me.id) ?? []).filter((i) => i.status === "suggested");
  if (openInterventions.length > 0) {
    items.push({
      icon: "activity",
      label: `${openInterventions.length} suggestion${openInterventions.length === 1 ? "" : "s"} for you`,
      href: "/burnout",
    });
  }

  if (pulseQuestion) {
    const answered = await hasAnsweredPulse(pulseQuestion.id);
    if (!answered) {
      items.push({ icon: "activity", label: "This week's pulse question is open", href: "/pulse" });
    }
  }

  return items;
}
