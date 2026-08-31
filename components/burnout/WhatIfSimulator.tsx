"use client";

import { useMemo, useState } from "react";
import { computeBurnoutV2, dominantDriverV2, type BurnoutV2Extras } from "@/lib/burnout-signals";
import { applyWhatIf, EMPTY_ADJUSTMENTS, type WhatIfAdjustments } from "@/lib/whatif";
import { ScoreBar } from "@/components/burnout/ScoreBar";
import { BandChip } from "@/components/burnout/BandChip";
import { BAND_TEXT } from "@/lib/burnout-bands";
import type { BurnoutInputs } from "@/lib/burnout";

interface SliderSpec {
  key: keyof WhatIfAdjustments;
  label: string;
  max: number;
  unit: string;
}

/** P8: sliders over lib/whatif.ts#applyWhatIf, re-running the exact same
 *  computeBurnoutV2 the live table uses — "if Rita takes 2 days off and 8
 *  hours move, projected 74 -> 56" as an interactive preview, not a new
 *  scoring model. Purely client-side arithmetic; nothing here writes
 *  anything, so there's no server action or persistence to wire up. */
export function WhatIfSimulator({
  inputs,
  extras,
}: {
  inputs: BurnoutInputs;
  extras: BurnoutV2Extras;
}) {
  const [adjustments, setAdjustments] = useState<WhatIfAdjustments>(EMPTY_ADJUSTMENTS);

  const baseline = useMemo(() => computeBurnoutV2(inputs, extras), [inputs, extras]);
  const projected = useMemo(() => {
    const perturbed = applyWhatIf(inputs, extras, adjustments);
    return computeBurnoutV2(perturbed.inputs, perturbed.extras);
  }, [inputs, extras, adjustments]);

  const isActive = Object.values(adjustments).some((v) => v > 0);
  const delta = Math.round(projected.compositeV2) - Math.round(baseline.compositeV2);

  const sliders: SliderSpec[] = [
    { key: "daysOff", label: "Days off this week", max: 5, unit: "d" },
    { key: "hoursMoved", label: "Task hours moved to teammates", max: Math.max(1, Math.round(extras.committedHours)), unit: "h" },
    { key: "overdueResolved", label: "Overdue tasks resolved", max: Math.max(1, extras.overdueTaskCount), unit: "" },
    { key: "offHoursReduced", label: "Off-hours activity cut", max: Math.max(1, Math.round(inputs.offHoursWeekly)), unit: "" },
  ];

  function setValue(key: keyof WhatIfAdjustments, value: number) {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setAdjustments(EMPTY_ADJUSTMENTS);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-ink-mute">What if?</div>
        {isActive ? (
          <button type="button" onClick={reset} className="text-xs font-medium text-brand hover:underline">
            Reset
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {sliders.map((s) => (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-soft">{s.label}</span>
              <span className="font-mono text-ink-mute">
                {adjustments[s.key]}
                {s.unit}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={s.max}
              step={1}
              value={adjustments[s.key]}
              onChange={(e) => setValue(s.key, Number(e.target.value))}
              className="w-full"
              style={{ accentColor: "var(--brand)" }}
              aria-label={s.label}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="text-center">
              <div className="font-mono text-lg font-bold text-ink-mute">{Math.round(baseline.compositeV2)}</div>
              <div className="text-xs text-ink-mute">Current</div>
            </div>
            <span aria-hidden="true" className="text-ink-mute">
              →
            </span>
            <div className="text-center">
              <div className="font-mono text-lg font-bold" style={{ color: BAND_TEXT[projected.bandV2] }}>
                {Math.round(projected.compositeV2)}
              </div>
              <div className="text-xs text-ink-mute">Projected</div>
            </div>
            {isActive ? (
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: delta < 0 ? "var(--risk-low)" : "var(--risk-high)" }}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            ) : null}
          </div>
          <BandChip band={projected.bandV2} />
        </div>

        {isActive ? (
          <div className="mt-3 space-y-2">
            <ScoreBar label="Task load" value={projected.taskLoad} />
            <ScoreBar label="Overdue" value={projected.overdue} />
            <ScoreBar label="Recovery" value={projected.recovery} />
          </div>
        ) : null}

        {isActive && baseline.bandV2 !== projected.bandV2 ? (
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            This combination would move them from {baseline.bandV2} to {projected.bandV2} risk. Today it&rsquo;s
            driven mainly by {dominantDriverV2(baseline).label}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
