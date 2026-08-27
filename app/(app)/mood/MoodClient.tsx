"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Icon } from "@/components/icons/Icon";
import { Axolotl } from "@/components/mood/Axolotl";
import { Sparkline } from "@/components/burnout/Sparkline";
import { MOODS } from "@/lib/constants";
import { submitMoodCheckin, updateMoodDetails } from "./actions";

export interface TeamAggregate {
  avgMood: number | null;
  checkinCount: number;
  avgMoodLastWeek: number | null;
  checkinCountLastWeek: number;
}

export interface OrgTrendPoint {
  day: string;
  avgMood: number | null;
  checkinCount: number;
}

export function MoodClient({
  initialPicked,
  initialEnergy,
  initialNote,
  streak,
  teamAggregates,
  orgAvgToday,
  orgAvgLastWeek,
  totalCheckinsToday,
  headcount,
  orgTrend,
}: {
  initialPicked: 1 | 2 | 3 | 4 | 5 | null;
  initialEnergy: number | null;
  initialNote: string;
  streak: number;
  teamAggregates: Record<string, TeamAggregate>;
  orgAvgToday: number | null;
  orgAvgLastWeek: number | null;
  totalCheckinsToday: number;
  headcount: number;
  orgTrend: OrgTrendPoint[];
}) {
  const [picked, setPicked] = useState<1 | 2 | 3 | 4 | 5 | null>(initialPicked);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pickedMood = picked ? MOODS[picked - 1] : null;
  const orgDelta = orgAvgToday !== null && orgAvgLastWeek !== null ? orgAvgToday - orgAvgLastWeek : null;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [energy, setEnergy] = useState<number | null>(initialEnergy);
  const [detailsNote, setDetailsNote] = useState(initialNote);
  const [detailsSaved, setDetailsSaved] = useState(initialEnergy !== null || initialNote.length > 0);
  const [detailsPending, startDetailsTransition] = useTransition();

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

  function handleSaveDetails() {
    startDetailsTransition(async () => {
      const result = await updateMoodDetails({ energy, note: detailsNote || null });
      if (result.ok) {
        setDetailsSaved(true);
        setDetailsOpen(false);
      }
    });
  }

  const trendValues = orgTrend.map((p) => p.avgMood ?? 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        {!pickedMood ? (
          <>
            <div role="group" aria-label="How are you feeling today?" className="mb-6 flex flex-wrap gap-3">
              {MOODS.map((mood) => {
                const isPicked = picked === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    disabled={picked !== null || isPending}
                    aria-pressed={isPicked}
                    onClick={() => handlePick(mood.value)}
                    className={`group flex w-20 flex-col items-center gap-2 rounded-xl border px-2 py-3 transition-colors disabled:cursor-not-allowed ${
                      isPicked ? "bg-surface" : "border-line bg-surface hover:bg-surface-2"
                    } ${picked !== null && !isPicked ? "opacity-40" : ""}`}
                    style={isPicked ? { borderColor: mood.body, background: `${mood.body}14` } : undefined}
                  >
                    <Axolotl mood={mood} active={isPicked} size={48} />
                    <span className="text-xs font-medium text-ink-soft">{mood.label}</span>
                  </button>
                );
              })}
            </div>
            {error ? <p className="mb-2 text-sm text-risk-critical">{error}</p> : null}
            <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-soft">
              <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
              <p>
                Your check-in is completely private. Team results only ever show once 3 or
                more people have responded — individual responses are never visible.
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <Axolotl mood={pickedMood} active size={96} />
            <div>
              <div className="text-sm font-medium text-ink-mute">
                You checked in as <span className="text-ink">{pickedMood.label}</span>
              </div>
              {streak > 1 ? (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  🔥 {streak}-day streak
                </div>
              ) : null}
              <blockquote className="mt-2 text-lg font-medium text-ink">“{pickedMood.quote}”</blockquote>
              <p className="mt-1 text-sm text-ink-mute">— {pickedMood.attribution}</p>
              {pickedMood.kicker ? (
                <p className="mt-3 text-sm font-medium text-brand-ink">{pickedMood.kicker}</p>
              ) : null}
              <p className="mt-4 text-sm text-ink-mute">
                That&apos;s today&apos;s check-in — see you back here tomorrow.
              </p>
            </div>

            {detailsSaved && !detailsOpen ? (
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="text-xs font-medium text-brand-ink underline-offset-2 hover:underline"
              >
                Edit energy / note
              </button>
            ) : !detailsOpen ? (
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="text-xs font-medium text-ink-mute underline-offset-2 hover:underline"
              >
                + Add energy level or a note (optional)
              </button>
            ) : null}

            {detailsOpen ? (
              <div className="w-full rounded-lg border border-line bg-surface-2 p-3 text-left">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-mute">Energy level</div>
                <div className="mb-3 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={energy === n}
                      onClick={() => setEnergy(energy === n ? null : n)}
                      className={`h-8 w-8 rounded-lg border text-xs font-semibold transition-colors ${
                        energy === n ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-mute"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <textarea
                  value={detailsNote}
                  onChange={(e) => setDetailsNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Anything you want to note (optional)…"
                  className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setDetailsOpen(false)} className="text-xs text-ink-mute">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={detailsPending}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {detailsPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionLabel className="mb-1">Team mood today</SectionLabel>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold" style={{ color: "var(--pillar-mood)" }}>
              {orgAvgToday !== null ? orgAvgToday.toFixed(1) : "—"}
            </span>
            <span className="text-sm text-ink-mute">/ 5</span>
            {orgDelta !== null && Math.abs(orgDelta) >= 0.05 ? (
              <span className="text-xs font-semibold" style={{ color: orgDelta > 0 ? "var(--risk-low)" : "var(--risk-high)" }}>
                {orgDelta > 0 ? "↑" : "↓"} {Math.abs(orgDelta).toFixed(1)} vs last week
              </span>
            ) : null}
          </div>
          <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-soft">
            Based on {totalCheckinsToday} of {headcount} responses today · Aggregates only
          </div>
        </Card>

        <Card>
          <SectionLabel className="mb-2">30-day org trend</SectionLabel>
          {trendValues.some((v) => v > 0) ? (
            <Sparkline values={trendValues} stroke="var(--pillar-mood)" filled width={272} height={48} />
          ) : (
            <p className="text-xs text-ink-mute">Not enough org-wide check-ins yet — each day needs 3+ to show.</p>
          )}
          <p className="mt-1 text-xs text-ink-mute">Days with fewer than 3 check-ins are excluded, never shown as zero.</p>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Team trends — today</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(teamAggregates).map(([team, agg]) => {
              const repMood = agg.avgMood !== null ? MOODS[Math.round(agg.avgMood) - 1] : MOODS[2];
              const delta =
                agg.avgMood !== null && agg.avgMoodLastWeek !== null ? agg.avgMood - agg.avgMoodLastWeek : null;
              return (
                <Card key={team}>
                  <div className="flex items-center gap-3">
                    <Axolotl mood={repMood} size={36} />
                    <div>
                      <div className="text-sm font-semibold text-ink">{team}</div>
                      {agg.avgMood !== null ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs text-ink-mute">avg {agg.avgMood.toFixed(1)} / 5</span>
                          {delta !== null && Math.abs(delta) >= 0.05 ? (
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: delta > 0 ? "#87D380" : "#FF8C73" }}
                            >
                              {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-ink-mute">Not enough check-ins yet</div>
                      )}
                    </div>
                  </div>
                  {agg.avgMood !== null ? (
                    <div className="mt-2.5">
                      <Sparkline seed={team} end={(agg.avgMood / 5) * 100} width={140} height={32} stroke={repMood.body} />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
