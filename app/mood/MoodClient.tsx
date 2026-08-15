"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/icons/Icon";
import { Axolotl } from "@/components/mood/Axolotl";
import { Sparkline } from "@/components/burnout/Sparkline";
import { MOODS } from "@/lib/constants";
import { seedFrom } from "@/lib/burnout";
import { TEAMS } from "@/lib/employees";

function teamAverage(team: string): number {
  const seed = seedFrom(team);
  const base = 3 + Math.sin(seed * 0.7) * 1.4;
  return Math.min(5, Math.max(1, base));
}

export function MoodClient() {
  const [picked, setPicked] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const pickedMood = picked ? MOODS[picked - 1] : null;

  return (
    <div>
      <div role="group" aria-label="How are you feeling today?" className="mb-8 flex flex-wrap gap-3">
        {MOODS.map((mood) => {
          const isPicked = picked === mood.value;
          return (
            <button
              key={mood.value}
              type="button"
              disabled={picked !== null}
              aria-pressed={isPicked}
              onClick={() => setPicked(mood.value)}
              className={`group flex w-24 flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-colors disabled:cursor-not-allowed ${
                isPicked
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-surface hover:bg-surface-2"
              } ${picked !== null && !isPicked ? "opacity-40" : ""}`}
            >
              <Axolotl mood={mood} active={isPicked} size={56} />
              <span className="text-xs font-medium text-ink-soft">{mood.label}</span>
            </button>
          );
        })}
      </div>

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
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="mt-4 text-sm font-medium text-brand hover:underline"
              >
                Check in again
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <h2 className="mb-4 text-lg font-semibold text-ink">Team trends — 14 days</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEAMS.map((team) => {
          const avg = teamAverage(team);
          const repMood = MOODS[Math.round(avg) - 1];
          return (
            <Card key={team}>
              <div className="flex items-center gap-3">
                <Axolotl mood={repMood} size={40} />
                <div>
                  <div className="text-sm font-semibold text-ink">{team}</div>
                  <div className="font-mono text-xs text-ink-mute">avg {avg.toFixed(1)} / 5</div>
                </div>
              </div>
              <div className="mt-3">
                <Sparkline seed={team} end={(avg / 5) * 100} width={160} height={40} stroke={repMood.body} />
              </div>
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
