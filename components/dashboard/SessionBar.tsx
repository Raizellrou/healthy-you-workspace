"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { clockIn, clockOut, startBreak, endBreak } from "@/app/(app)/attendance/actions";
import { fmtClock, fmtDuration, fmtMinutes, minutesSinceMidnightInTz } from "@/lib/date";
import type { OpenSession } from "@/lib/supabase/attendance";

/**
 * Richer "Your session" bar for the dashboard — same underlying clock
 * in/out/break actions as the sidebar ClockWidget, laid out as a segmented
 * stat bar instead of a compact vertical card. ClockWidget itself is left
 * untouched since it's shared with the nav rail, where this bar's width
 * wouldn't fit.
 */
export function SessionBar({
  openSession,
  schedule,
  timezone,
  last7DaysHours,
}: {
  openSession: OpenSession | null;
  schedule: { startMin: number; endMin: number } | null;
  timezone: string;
  last7DaysHours: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  const onBreak = Boolean(openSession?.openBreak);
  const elapsedMs = openSession ? now - new Date(openSession.clockIn).getTime() : 0;
  const breaksTodayMs = openSession
    ? openSession.completedBreakMs + (onBreak ? now - new Date(openSession.openBreak!.breakStart).getTime() : 0)
    : 0;

  // EARLY/ON TIME/LATE compares the clock-in instant against the scheduled
  // shift start, in the employee's own timezone — a 5-minute band around
  // startMin reads as "on time" rather than demanding the exact minute.
  let punctuality: { label: string; tone: "success" | "neutral" | "warning" } | null = null;
  if (openSession && schedule) {
    const clockInMinutes = minutesSinceMidnightInTz(new Date(openSession.clockIn), timezone);
    const diff = clockInMinutes - schedule.startMin;
    punctuality =
      diff < -5 ? { label: "Early", tone: "success" } : diff > 5 ? { label: "Late", tone: "warning" } : { label: "On time", tone: "neutral" };
  }

  return (
    <div className="flex flex-wrap items-stretch gap-x-6 gap-y-4">
      <div className="flex flex-col gap-1.5 border-r border-line pr-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Elapsed</span>
          {punctuality ? <Chip tone={punctuality.tone}>{punctuality.label}</Chip> : null}
        </div>
        <div className="font-mono text-2xl font-bold tabular-nums text-ink">
          {openSession && mounted ? fmtClock(elapsedMs) : "—:—:—"}
        </div>
        {openSession ? (
          <div className="flex gap-1.5">
            {onBreak ? (
              <button
                type="button"
                onClick={() => run(endBreak)}
                disabled={isPending}
                className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={() => run(() => startBreak("short"))}
                disabled={isPending}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-line disabled:opacity-60"
              >
                Break
              </button>
            )}
            <button
              type="button"
              onClick={() => run(clockOut)}
              disabled={isPending}
              className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              Time out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => run(clockIn)}
            disabled={isPending}
            className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            Clock in
          </button>
        )}
      </div>

      <div className="flex flex-col justify-center gap-1 border-r border-line pr-6">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Last 7 days</span>
        <span className="text-lg font-bold text-ink">{fmtDuration(last7DaysHours * 3_600_000)}</span>
      </div>

      <div className="flex flex-col justify-center gap-1 border-r border-line pr-6">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Breaks today</span>
        <span className="font-mono text-lg font-bold tabular-nums text-ink">
          {openSession && mounted ? fmtClock(breaksTodayMs) : "—:—:—"}
        </span>
      </div>

      {schedule ? (
        <div className="flex flex-col justify-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Schedule</span>
          <span className="text-lg font-bold text-ink">
            {fmtMinutes(schedule.startMin)}–{fmtMinutes(schedule.endMin)}
          </span>
        </div>
      ) : null}

      {error && <p className="w-full text-xs text-risk-critical">{error}</p>}
    </div>
  );
}
