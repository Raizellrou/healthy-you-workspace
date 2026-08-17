"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/icons/Icon";
import { Axolotl } from "@/components/mood/Axolotl";
import { Sparkline } from "@/components/burnout/Sparkline";
import { MOODS } from "@/lib/constants";
import { submitMoodCheckin } from "./actions";

export interface TeamAggregate {
  avgMood: number | null;
  checkinCount: number;
  avgMoodLastWeek: number | null;
}

export function MoodClient({
  initialPicked,
  teamAggregates,
}: {
  initialPicked: 1 | 2 | 3 | 4 | 5 | null;
  teamAggregates: Record<string, TeamAggregate>;
}) {
  const [picked, setPicked] = useState<1 | 2 | 3 | 4 | 5 | null>(initialPicked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pickedMood = picked ? MOODS[picked - 1] : null;

  function handlePick(value: 1 | 2 | 3 | 4 | 5) {
    setError(null);
    setPicked(value);
    startTransition(async () => {
      const result = await submitMoodCheckin(value);
      if (!result.ok) {
        setPicked(initialPicked);
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div>
      <div role="group" aria-label="How are you feeling today?" className="mb-8 flex flex-wrap gap-3">
        {MOODS.map((mood) => {
          const isPicked = picked === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              disabled={picked !== null || isPending}
              aria-pressed={isPicked}
              onClick={() => handlePick(mood.value)}
              className={`group flex w-24 flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-colors disabled:cursor-not-allowed ${
                isPicked ? "bg-surface" : "border-line bg-surface hover:bg-surface-2"
              } ${picked !== null && !isPicked ? "opacity-40" : ""}`}
              style={isPicked ? { borderColor: mood.body, background: `${mood.body}14` } : undefined}
            >
              <Axolotl mood={mood} active={isPicked} size={56} />
              <span className="text-xs font-medium text-ink-soft">{mood.label}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mb-4 text-sm text-risk-critical">{error}</p> : null}

      {pickedMood ? (
        <Card className="mb-10">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Axolotl mood={pickedMood} active size={112} />
            <div>
              <div className="text-sm font-medium text-ink-mute">
                You checked in as <span className="text-ink">{pickedMood.label}</span>
              </div>
              <blockquote className="mt-2 text-lg font-medium text-ink">
                “{pickedMood.quote}”
              </blockquote>
              <p className="mt-1 text-sm text-ink-mute">— {pickedMood.attribution}</p>
              {pickedMood.kicker ? (
                <p className="mt-3 text-sm font-medium text-brand-ink">{pickedMood.kicker}</p>
              ) : null}
              <p className="mt-4 text-sm text-ink-mute">
                That&apos;s today&apos;s check-in — see you back here tomorrow.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <h2 className="mb-4 text-lg font-semibold text-ink">Team trends — today</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(teamAggregates).map(([team, agg]) => {
          const repMood = agg.avgMood !== null ? MOODS[Math.round(agg.avgMood) - 1] : MOODS[2];
          const delta =
            agg.avgMood !== null && agg.avgMoodLastWeek !== null ? agg.avgMood - agg.avgMoodLastWeek : null;
          return (
            <Card key={team}>
              <div className="flex items-center gap-3">
                <Axolotl mood={repMood} size={40} />
                <div>
                  <div className="text-sm font-semibold text-ink">{team}</div>
                  {agg.avgMood !== null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-ink-mute">avg {agg.avgMood.toFixed(1)} / 5</span>
                      {delta !== null && Math.abs(delta) >= 0.05 ? (
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: delta > 0 ? "#87D380" : "#FF8C73" }}
                        >
                          {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)} vs last wk
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-ink-mute">Not enough check-ins yet</div>
                  )}
                </div>
              </div>
              {agg.avgMood !== null ? (
                <div className="mt-3">
                  <Sparkline
                    seed={team}
                    end={(agg.avgMood / 5) * 100}
                    width={160}
                    height={40}
                    stroke={repMood.body}
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-4 text-sm text-ink-soft">
        <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
        <p>
          Individual check-ins are never queryable by name — only team and day-level
          aggregates are ever shown, and only once a team has enough responses to stay
          anonymous.
        </p>
      </div>
    </div>
  );
}
