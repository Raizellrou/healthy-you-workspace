import { Sidebar } from "@/components/shell/Sidebar";
import { ToastDock } from "@/components/nudges/ToastDock";
import { NudgePersistence } from "@/components/nudges/NudgePersistence";
import { UiPreferencesApplier } from "@/components/shell/UiPreferencesApplier";
import { NudgeProvider } from "@/lib/nudge-context";
import { getCurrentEmployeeId, getEmployees } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getOpenSession } from "@/lib/supabase/attendance";
import { getUnreadCount } from "@/lib/supabase/notifications";
import { getUiPreferences, DEFAULT_UI_PREFERENCES } from "@/lib/supabase/preferences";
import { getCurrentMeeting } from "@/lib/supabase/meetings";
import { getRespectCalendar } from "@/lib/supabase/nudge-prefs";
import { computeBurnout } from "@/lib/burnout";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [employees, currentEmployeeId, currentPerson] = await Promise.all([
    getEmployees(),
    getCurrentEmployeeId(),
    getCurrentPerson(),
  ]);
  const hasCritical = employees.some((e) => computeBurnout(e).band === "critical");
  const currentEmployee = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const [openSession, unreadInboxCount, uiPreferences, currentMeeting, respectCalendar] = currentEmployeeId
    ? await Promise.all([
        getOpenSession(currentEmployeeId),
        getUnreadCount(currentEmployeeId),
        getUiPreferences(currentEmployeeId),
        getCurrentMeeting(currentEmployeeId),
        getRespectCalendar(currentEmployeeId),
      ])
    : [null, 0, DEFAULT_UI_PREFERENCES, null, true];

  return (
    <NudgeProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar
          hasCritical={hasCritical}
          currentEmployee={currentEmployee}
          appRole={currentPerson?.appRole}
          openSession={openSession}
          unreadInboxCount={unreadInboxCount}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <ToastDock
        inMeeting={Boolean(respectCalendar && currentMeeting)}
        meetingTitle={currentMeeting?.title ?? null}
      />
      <NudgePersistence />
      <UiPreferencesApplier prefs={uiPreferences} />
    </NudgeProvider>
  );
}
