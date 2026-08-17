"use client";

import { useNudges } from "@/lib/nudge-context";

// Nudges are a session-local simulation (see lib/nudge-context.tsx) — there's
// no persisted org-wide count, so this reports the current browser session's
// count rather than fabricating an org-wide number.
export function NudgeStat() {
  const { dailyCount } = useNudges();
  return (
    <span className="text-xs font-semibold" style={{ color: "#C7A2E5" }}>
      {dailyCount} this session
    </span>
  );
}
