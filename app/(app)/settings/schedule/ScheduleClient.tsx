"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { fmtMinutes } from "@/lib/date";
import { toMinutes } from "@/lib/time";
import { updateSchedule, updateNotificationPrefs } from "@/app/(app)/settings/actions";
import type { NotificationPrefsSettings, WorkScheduleSettings } from "@/lib/supabase/notifications";
import type { NotificationKind } from "@/lib/notify";

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const KIND_LABELS: Record<NotificationKind, string> = {
  task_assigned: "Task assignments",
  mention: "Mentions",
  pto_decided: "PTO decisions",
  due_soon: "Due-soon reminders",
  message_held: "Held boundary messages",
  task_reassigned: "Workload rebalance moves",
  intervention_suggested: "Burnout interventions",
  one_on_one_scheduled: "1:1 invitations",
};

function parseTimeValue(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return toMinutes(h || 0, m || 0);
}

export function ScheduleClient({
  schedule,
  prefs,
}: {
  schedule: WorkScheduleSettings;
  prefs: NotificationPrefsSettings;
}) {
  const [workdays, setWorkdays] = useState(new Set(schedule.workdays));
  const [startMin, setStartMin] = useState(schedule.startMin);
  const [endMin, setEndMin] = useState(schedule.endMin);
  const [quietStartMin, setQuietStartMin] = useState(schedule.quietStartMin);
  const [quietEndMin, setQuietEndMin] = useState(schedule.quietEndMin);
  const [batchingMode, setBatchingMode] = useState(prefs.batchingMode);
  const [mutedKinds, setMutedKinds] = useState(new Set(prefs.mutedKinds));

  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savedSchedule, setSavedSchedule] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleDay(day: number) {
    setWorkdays((cur) => {
      const next = new Set(cur);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleMutedKind(kind: NotificationKind) {
    setMutedKinds((cur) => {
      const next = new Set(cur);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function handleSaveSchedule() {
    setScheduleError(null);
    setSavedSchedule(false);
    startTransition(async () => {
      const result = await updateSchedule({
        workdays: [...workdays],
        startMin,
        endMin,
        quietStartMin,
        quietEndMin,
      });
      if (!result.ok) {
        setScheduleError(result.error ?? "Failed to save.");
        return;
      }
      setSavedSchedule(true);
    });
  }

  function handleSavePrefs() {
    setSavedPrefs(false);
    startTransition(async () => {
      const result = await updateNotificationPrefs({ batchingMode, mutedKinds: [...mutedKinds] });
      if (result.ok) setSavedPrefs(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 text-sm font-semibold text-ink">Working hours</div>
        {scheduleError && (
          <div className="mb-3 rounded-lg border border-risk-critical/30 bg-risk-critical/10 px-3 py-2 text-sm text-risk-critical">
            {scheduleError}
          </div>
        )}

        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-ink">Workdays</div>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={workdays.has(d.value)}
                onClick={() => toggleDay(d.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  workdays.has(d.value)
                    ? "bg-brand text-white"
                    : "border border-line text-ink-mute hover:bg-surface-2"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start of day">
            {(p) => (
              <input
                {...p}
                type="time"
                value={fmtMinutes(startMin)}
                onChange={(e) => setStartMin(parseTimeValue(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            )}
          </Field>
          <Field label="End of day">
            {(p) => (
              <input
                {...p}
                type="time"
                value={fmtMinutes(endMin)}
                onChange={(e) => setEndMin(parseTimeValue(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            )}
          </Field>
          <Field label="Quiet hours start" hint="Notifications hold until your next workday start.">
            {(p) => (
              <input
                {...p}
                type="time"
                value={fmtMinutes(quietStartMin)}
                onChange={(e) => setQuietStartMin(parseTimeValue(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            )}
          </Field>
          <Field label="Quiet hours end">
            {(p) => (
              <input
                {...p}
                type="time"
                value={fmtMinutes(quietEndMin)}
                onChange={(e) => setQuietEndMin(parseTimeValue(e.target.value))}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            )}
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleSaveSchedule} disabled={isPending}>
            {isPending ? "Saving…" : "Save schedule"}
          </Button>
          {savedSchedule && <span className="text-xs text-success">Saved.</span>}
        </div>
      </Card>

      <Card>
        <div className="mb-4 text-sm font-semibold text-ink">Notifications</div>

        <Field label="Delivery pacing" className="mb-4" hint="Quiet hours always win, regardless of this setting.">
          {(p) => (
            <Select
              {...p}
              value={batchingMode}
              onChange={(e) => setBatchingMode(e.target.value as typeof batchingMode)}
              options={[
                { value: "immediate", label: "Immediate" },
                { value: "hourly", label: "Batched hourly" },
                { value: "daily_digest", label: "Once a day" },
              ]}
            />
          )}
        </Field>

        <div className="mb-4">
          <div className="mb-1.5 text-sm font-medium text-ink">Muted</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND_LABELS) as NotificationKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={mutedKinds.has(kind)}
                onClick={() => toggleMutedKind(kind)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mutedKinds.has(kind)
                    ? "border-risk-critical/30 bg-risk-critical/10 text-risk-critical"
                    : "border-line text-ink-mute hover:bg-surface-2"
                }`}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="secondary" onClick={handleSavePrefs} disabled={isPending}>
            {isPending ? "Saving…" : "Save preferences"}
          </Button>
          {savedPrefs && <span className="text-xs text-success">Saved.</span>}
        </div>
      </Card>
    </div>
  );
}
