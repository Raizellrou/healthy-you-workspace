"use client";

import { useEffect, useRef } from "react";
import { useNudges } from "@/lib/nudge-context";
import { NudgeToastCard } from "@/components/nudges/NudgeToastCard";
import { recordNudgeEvent } from "@/app/(app)/nudges/actions";

/**
 * Calendar-aware nudge suppression.
 *
 * lib/nudge-context.tsx is frozen and is a closed client-side loop with no
 * injection point, so the simulation cannot be *taught* about meetings.
 * What it can be given is a gate on the way out: while the person is in a
 * meeting and has respect_calendar on (0024), the toast is simply not
 * rendered.
 *
 * The nudge is held rather than cancelled: nothing calls `resolveToast`,
 * so the context keeps the toast active and it renders once the gate
 * reopens, rather than the reminder being silently dropped. Note the
 * honest limit — `inMeeting` is a server-rendered prop on the app layout,
 * so it refreshes when that layout re-renders (a navigation that reaches
 * the server, or a router.refresh()), not the literal second a meeting
 * ends. Good enough for a reminder to stretch; not a real-time gate.
 *
 * The suppression is recorded to nudge_events with a reason, once per
 * toast, so "your nudges were held 14 times, all during meetings" comes
 * from real rows. It is deliberately NOT recorded while the user is on
 * /nudges: the dock never renders there anyway (the page shows nudges as
 * cards instead), so logging a meeting-suppression for those would inflate
 * the count with events the meeting had no part in hiding.
 *
 * One consequence worth knowing when querying nudge_events: a suppressed
 * nudge produces TWO rows — the frozen context logs its own 'sent' the
 * moment it fires, and NudgePersistence faithfully writes that, then this
 * component writes the 'suppressed' row describing what actually reached
 * the person. The frozen module cannot be told to log otherwise. So
 * `result = 'sent'` means "the simulation raised it", not "a human saw
 * it"; pair it with the suppressed rows to get the latter.
 */
export function ToastDock({
  inMeeting = false,
  meetingTitle = null,
}: {
  inMeeting?: boolean;
  meetingTitle?: string | null;
}) {
  const { activeToast, isOnNudgesRoute, resolveToast } = useNudges();
  const recordedFor = useRef<Set<string>>(new Set());

  // Only counts as a meeting-suppression if the dock would otherwise have
  // shown it — on /nudges it never would have.
  const suppressed = Boolean(activeToast) && inMeeting && !isOnNudgesRoute;

  useEffect(() => {
    if (!suppressed || !activeToast) return;
    if (recordedFor.current.has(activeToast.id)) return;
    recordedFor.current.add(activeToast.id);
    void recordNudgeEvent({
      nudgeType: activeToast.type,
      result: "suppressed",
      reason: meetingTitle ? `In a meeting: ${meetingTitle}` : "In a meeting",
    });
  }, [suppressed, activeToast, meetingTitle]);

  if (!activeToast || isOnNudgesRoute || suppressed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <NudgeToastCard
        type={activeToast.type}
        onDone={() => resolveToast("done")}
        onSnooze={() => resolveToast("snooze")}
        onDismiss={() => resolveToast("done")}
      />
    </div>
  );
}
