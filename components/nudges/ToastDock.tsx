"use client";

import { useNudges } from "@/lib/nudge-context";
import { NudgeToastCard } from "@/components/nudges/NudgeToastCard";

export function ToastDock() {
  const { activeToast, isOnNudgesRoute, resolveToast } = useNudges();

  if (!activeToast || isOnNudgesRoute) return null;

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
