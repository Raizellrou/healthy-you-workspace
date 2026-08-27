import { NavRail } from "@/components/shell/NavRail";
import { NavPanel } from "@/components/shell/NavPanel";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { ToastDock } from "@/components/nudges/ToastDock";
import { NudgePersistence } from "@/components/nudges/NudgePersistence";
import { UiPreferencesApplier } from "@/components/shell/UiPreferencesApplier";
import { NudgeProvider } from "@/lib/nudge-context";
import { getCurrentEmployeeId, getEmployees, getProjects } from "@/lib/supabase/queries";
import { getCurrentPerson } from "@/lib/supabase/people";
import { getUnreadCount } from "@/lib/supabase/notifications";
import { getUiPreferences, DEFAULT_UI_PREFERENCES } from "@/lib/supabase/preferences";
import { getCurrentMeeting } from "@/lib/supabase/meetings";
import { getRespectCalendar } from "@/lib/supabase/nudge-prefs";
import { computeBurnout } from "@/lib/burnout";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Projects are fetched here rather than in app/(app)/tasks/layout.tsx
  // because they render as nav-panel destinations now, which means the
  // shell needs them on every route, not only under /tasks.
  const [employees, currentEmployeeId, currentPerson, projects] = await Promise.all([
    getEmployees(),
    getCurrentEmployeeId(),
    getCurrentPerson(),
    getProjects(),
  ]);
  const hasCritical = employees.some((e) => computeBurnout(e).band === "critical");
  const currentEmployee = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const [unreadInboxCount, uiPreferences, currentMeeting, respectCalendar] = currentEmployeeId
    ? await Promise.all([
        getUnreadCount(currentEmployeeId),
        getUiPreferences(currentEmployeeId),
        getCurrentMeeting(currentEmployeeId),
        getRespectCalendar(currentEmployeeId),
      ])
    : [0, DEFAULT_UI_PREFERENCES, null, true];

  return (
    <NudgeProvider>
      {/* The shell owns the viewport; `main` is the only scroll container.
          Previously the document scrolled, which put a full-height scrollbar
          at the viewport edge — visually cutting past the nav — and shifted
          content width by the scrollbar's ~15px between pages that scrolled
          and pages that didn't. `h-dvh` rather than `h-screen` so mobile
          browser chrome collapsing doesn't clip the bottom. */}
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
        <MobileTabBar
          hasCritical={hasCritical}
          appRole={currentPerson?.appRole}
          unreadInboxCount={unreadInboxCount}
        />
        <NavRail
          hasCritical={hasCritical}
          appRole={currentPerson?.appRole}
          unreadInboxCount={unreadInboxCount}
        />
        <NavPanel
          hasCritical={hasCritical}
          currentEmployee={currentEmployee}
          appRole={currentPerson?.appRole}
          unreadInboxCount={unreadInboxCount}
          projects={projects}
          defaultTaskView={uiPreferences.defaultTaskView}
        />
        {/* scrollbar-gutter reserves the track whether or not this page
            overflows, so content width is identical on every route —
            without it a short page renders 10px wider than a long one and
            the whole layout shifts as you navigate. The track is
            transparent (globals.css), so the reserved strip is invisible
            until there is something to scroll. */}
        <main className="min-w-0 flex-1 overflow-y-auto pb-16 [scrollbar-gutter:stable] md:pb-0">{children}</main>
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
