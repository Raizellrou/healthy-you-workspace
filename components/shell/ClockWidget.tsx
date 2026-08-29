"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockIn, clockOut, startBreak, endBreak, type ClockOutSummary } from "@/app/(app)/attendance/actions";
import { fmtDuration, fmtDateTime } from "@/lib/date";
import { sessionGuardrails } from "@/lib/guardrails";
import type { OpenSession } from "@/lib/supabase/attendance";

/**
 * Sidebar clock in/out — there was no way to record real attendance
 * anywhere before P4; `daily_activity.worked_today` was a seeded boolean,
 * never written by the app itself.
 *
 * The client ticks a display-only interval; every timestamp that actually
 * gets persisted comes from Postgres `now()` inside the server action
 * (app/(app)/attendance/actions.ts), never from this component's clock.
 * Elapsed time only renders after `mounted` flips in an effect — computing
 * it from `Date.now()` during the initial render would disagree with the
 * server-rendered markup and trigger a hydration mismatch, the same
 * strict-mode-safe pattern lib/nudge-context.tsx already uses for its timer.
 */
type PendingAction = "clockIn" | "clockOut" | "break" | "resume" | null;

const PENDING_LABEL: Record<Exclude<PendingAction, null>, string> = {
  clockIn: "Clocking in…",
  clockOut: "Clocking out…",
  break: "Starting break…",
  resume: "Resuming…",
};

export function ClockWidget({ openSession }: { openSession: OpenSession | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lastSummary, setLastSummary] = useState<ClockOutSummary | null>(null);

  useEffect(() => {
    // One-time read of client-only state (Date.now()) on mount, deferred to
    // an effect so the SSR pass and first client render agree before this
    // can diverge — same pattern as components/shell/ThemeToggle.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function run(
    kind: Exclude<PendingAction, null>,
    action: () => Promise<{ ok: boolean; error?: string; summary?: ClockOutSummary }>
  ) {
    setError(null);
    setPendingAction(kind);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
      } else if (kind === "clockOut" && result.summary) {
        setLastSummary(result.summary);
      }
      setPendingAction(null);
      router.refresh();
    });
  }

  if (!openSession) {
    return (
      <div className="flex flex-col gap-1.5">
        {lastSummary && (
          <div className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2 text-xs">
            <span className="font-medium text-ink-soft">Last session</span>
            <div className="flex items-center justify-between text-ink-mute">
              <span>Clock in</span>
              <span className="font-mono text-ink">{fmtDateTime(lastSummary.clockIn)}</span>
            </div>
            <div className="flex items-center justify-between text-ink-mute">
              <span>Break time</span>
              <span className="font-mono text-ink">{fmtDuration(lastSummary.breakMinutes * 60_000)}</span>
            </div>
            <div className="flex items-center justify-between text-ink-mute">
              <span>Clock out</span>
              <span className="font-mono text-ink">{fmtDateTime(lastSummary.clockOut)}</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setLastSummary(null);
            run("clockIn", clockIn);
          }}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isPending && pendingAction === "clockIn" ? PENDING_LABEL.clockIn : "Clock in"}
        </button>
        {error && <p className="text-xs text-risk-critical">{error}</p>}
      </div>
    );
  }

  const onBreak = Boolean(openSession.openBreak);
  const elapsedMs = now - new Date(onBreak ? openSession.openBreak!.breakStart : openSession.clockIn).getTime();

  // Guardrails render only after `mounted`, for the same reason the elapsed
  // clock does: they are derived from Date.now() and would otherwise
  // disagree with the server-rendered markup.
  const sinceClockIn = now - new Date(openSession.clockIn).getTime();
  const sinceBreak = now - new Date(openSession.lastBreakEnd ?? openSession.clockIn).getTime();
  const guardrails = mounted
    ? sessionGuardrails({
        elapsedMinutes: Math.floor(sinceClockIn / 60_000),
        minutesSinceBreak: Math.floor(sinceBreak / 60_000),
        hasTakenBreak: openSession.breakCount > 0,
        onBreakNow: onBreak,
      })
    : [];

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-ink-soft">
          <span
            className={`h-1.5 w-1.5 rounded-full ${onBreak ? "bg-risk-medium" : "bg-success"}`}
            aria-hidden="true"
          />
          {onBreak ? "On break" : "Clocked in"}
        </span>
        <span className="font-mono text-ink-mute">{mounted ? fmtDuration(elapsedMs) : "—"}</span>
      </div>
      <div className="flex gap-1.5">
        {onBreak ? (
          <button
            type="button"
            onClick={() => run("resume", endBreak)}
            disabled={isPending}
            className="flex-1 rounded-lg bg-brand px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            {isPending && pendingAction === "resume" ? PENDING_LABEL.resume : "Resume"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run("break", () => startBreak("short"))}
            disabled={isPending}
            className="flex-1 rounded-lg bg-surface-2 px-2 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-line disabled:opacity-60"
          >
            {isPending && pendingAction === "break" ? PENDING_LABEL.break : "Break"}
          </button>
        )}
        <button
          type="button"
          onClick={() => run("clockOut", clockOut)}
          disabled={isPending}
          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-60"
        >
          {isPending && pendingAction === "clockOut" ? PENDING_LABEL.clockOut : "Clock out"}
        </button>
      </div>
      {guardrails.map((g) => (
        <p
          key={g.kind}
          className={`text-[11px] leading-snug ${g.tone === "warn" ? "text-risk-high" : "text-ink-mute"}`}
        >
          {g.message}
        </p>
      ))}
      {error && <p className="text-xs text-risk-critical">{error}</p>}
    </div>
  );
}
