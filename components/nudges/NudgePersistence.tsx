"use client";

import { useEffect, useRef } from "react";
import { useNudges } from "@/lib/nudge-context";
import { recordNudgeEvent } from "@/app/(app)/nudges/actions";

/**
 * Additive persistence for the frozen lib/nudge-context.tsx simulation —
 * mounted once inside NudgeProvider (app/(app)/layout.tsx), diffs `log` on
 * every change, and writes each new entry to nudge_events. Zero edits to
 * the frozen context: this only reads its public `log` array.
 *
 * Renders nothing.
 */
export function NudgePersistence() {
  const { log } = useNudges();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = log.filter((entry) => !seenIds.current.has(entry.id));
    if (fresh.length === 0) return;
    for (const entry of fresh) {
      seenIds.current.add(entry.id);
      void recordNudgeEvent({
        nudgeType: entry.type,
        result: entry.result,
        reason: entry.reason ?? null,
      });
    }
  }, [log]);

  return null;
}
