"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { interventionFor } from "@/lib/interventions";
import { dominantDriverV2, type BurnoutV2Scores } from "@/lib/burnout-signals";
import {
  createIntervention,
  acceptIntervention,
  dismissIntervention,
  applyQuietHoursIntervention,
} from "@/app/(app)/burnout/actions";
import type { Intervention } from "@/lib/supabase/interventions";

/** P8: the intervention engine's UI half. Turns "driven mainly by X" from
 *  static text into a button that raises a tracked, resolvable action —
 *  see lib/interventions.ts for what each driver maps to and
 *  app/(app)/burnout/actions.ts for what each action_type actually does. */
export function InterventionPanel({
  employeeId,
  scores,
  canManage,
  isSelf,
  latestIntervention,
}: {
  employeeId: string;
  scores: BurnoutV2Scores;
  canManage: boolean;
  isSelf: boolean;
  latestIntervention: Intervention | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCritical = scores.bandV2 === "high" || scores.bandV2 === "critical";
  const active = latestIntervention?.status === "suggested" ? latestIntervention : null;

  if (!isCritical && !latestIntervention) return null;

  const driver = dominantDriverV2(scores);
  const spec = interventionFor(driver.key);

  function run(key: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setPending(key);
    startTransition(async () => {
      const result = await action();
      setPending(null);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  function handleCreate() {
    run("create", () =>
      createIntervention({
        employeeId,
        driver: driver.key,
        scoreAtCreation: Math.round(scores.compositeV2),
      })
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-risk-critical/25 bg-risk-critical/10 p-3">
      <div className="mb-1 text-xs font-bold text-risk-critical">Recommended action</div>

      {!active ? (
        <>
          <p className="text-xs leading-relaxed text-ink-soft">
            {isCritical
              ? `Consider a 1:1 check-in this week — driven mainly by ${driver.label}.`
              : `Monitor closely — driven mainly by ${driver.label}.`}
          </p>
          {latestIntervention ? (
            <p className="mt-2 text-[11px] text-ink-mute">
              Previous suggestion ({interventionFor(latestIntervention.driver).label}) was {latestIntervention.status}.
            </p>
          ) : null}
          {canManage && isCritical ? (
            <div className="mt-2.5">
              <Button variant="secondary" size="sm" onClick={handleCreate} disabled={isPending}>
                {pending === "create" ? "Raising…" : spec.label}
              </Button>
              <p className="mt-1.5 text-[11px] text-ink-mute">{spec.description}</p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">{interventionFor(active.driver).label}</span> —{" "}
            {interventionFor(active.driver).description}
          </p>
          {(isSelf || canManage) && active.actionType === "strict_quiet_hours" && isSelf ? (
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => run("apply", () => applyQuietHoursIntervention(active.id))}
                disabled={isPending}
              >
                {pending === "apply" ? "Applying…" : "Apply"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => run("dismiss", () => dismissIntervention(active.id))}
                disabled={isPending}
              >
                Dismiss
              </Button>
            </div>
          ) : active.actionType === "strict_quiet_hours" && !isSelf ? (
            <p className="mt-2 text-[11px] text-ink-mute">Waiting for them to apply this themselves.</p>
          ) : isSelf || canManage ? (
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => run("accept", () => acceptIntervention(active.id))}
                disabled={isPending}
              >
                {pending === "accept" ? "Saving…" : "Mark done"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => run("dismiss", () => dismissIntervention(active.id))}
                disabled={isPending}
              >
                Dismiss
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-ink-mute">Flagged, pending.</p>
          )}
        </>
      )}

      {error ? <p className="mt-2 text-[11px] text-risk-critical">{error}</p> : null}
    </div>
  );
}
