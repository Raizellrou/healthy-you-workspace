"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { computeBurnout } from "@/lib/burnout";
import { fmtMinutes } from "@/lib/date";
import type { FocusBlock } from "@/lib/focus-timeline";
import { WORKSPACE_COPY, type WorkspaceState } from "@/lib/constants";
import { startFocusSession, endFocusSession } from "./actions";
import type { OpenFocusSession, FocusMode } from "@/lib/supabase/focus";
import type { Employee } from "@/types/employee";

const STATE_BUTTONS: WorkspaceState[] = ["standard", "focus", "calm"];

const STATE_ACCENT: Record<WorkspaceState, string> = {
  standard: "#6F49A6",
  focus: "#87CEEB",
  calm: "#A8D592",
};

const BLOCK_COLOR: Record<FocusBlock["kind"], string> = {
  worked: "#6F49A6",
  break: "#A8D592",
  gap: "var(--surface-2)",
};

const BLOCK_LABEL: Record<FocusBlock["kind"], string> = {
  worked: "Clocked in",
  break: "On break",
  gap: "Open",
};

/** Real replacement for the old computeBurnout-only suggestion: Calm once
 *  the frozen base composite reaches "high" or above, matching the plan's
 *  "auto-suggest Calm at band >= high" — the original code suggested
 *  "focus" at that threshold instead. */
function autoSuggest(employee: Employee): WorkspaceState {
  const band = computeBurnout(employee).band;
  return band === "high" || band === "critical" ? "calm" : "standard";
}

export function FocusClient({
  employees,
  currentEmployeeId,
  timelineByEmployee,
  dueTodayByEmployee,
  openSession,
}: {
  employees: Employee[];
  currentEmployeeId: string | null;
  timelineByEmployee: Record<string, FocusBlock[]>;
  dueTodayByEmployee: Record<string, number>;
  openSession: OpenFocusSession | null;
}) {
  const [employeeId, setEmployeeId] = useState(currentEmployeeId ?? employees[0].id);
  // Reflects an already-open session's real mode on first render, instead
  // of falling back to the suggested state and only diverging once the
  // user clicks something — a reload while a session is open was showing
  // "Standard mode active" text even though the persisted session (and the
  // highlighted button) said Focus.
  const [manualState, setManualState] = useState<WorkspaceState | null>(
    currentEmployeeId && openSession ? openSession.mode : null
  );
  const [pendingMode, setPendingMode] = useState<FocusMode | "ending" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<{ tasksCompleted: number; notificationsSuppressed: number } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const suggested = autoSuggest(employee);
  const activeState = manualState ?? suggested;
  const timeline = timelineByEmployee[employeeId] ?? [];
  const dueToday = dueTodayByEmployee[employeeId] ?? 0;
  const isSelf = employeeId === currentEmployeeId;

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    setManualState(null);
  }

  function handleStart(mode: WorkspaceState) {
    setManualState(mode);
    if (!isSelf) return;
    setError(null);
    setPendingMode(mode as FocusMode);
    setLastSummary(null);
    startTransition(async () => {
      const result = await startFocusSession({ mode, trigger: "manual" });
      setPendingMode(null);
      if (!result.ok) setError(result.error ?? "Couldn't start that session.");
    });
  }

  function handleEnd() {
    setError(null);
    setPendingMode("ending");
    startTransition(async () => {
      const result = await endFocusSession();
      setPendingMode(null);
      if (!result.ok) {
        setError(result.error ?? "Couldn't end the session.");
        return;
      }
      setLastSummary({
        tasksCompleted: (result as { tasksCompleted?: number }).tasksCompleted ?? 0,
        notificationsSuppressed: (result as { notificationsSuppressed?: number }).notificationsSuppressed ?? 0,
      });
    });
  }

  return (
    <div>
      <Card className="mb-5">
        <label htmlFor="focus-employee" className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">
          Employee
        </label>
        <select
          id="focus-employee"
          value={employeeId}
          onChange={(e) => handleEmployeeChange(e.target.value)}
          className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.id === currentEmployeeId ? " (you)" : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-mute">
          Suggested: <span className="font-medium text-ink-soft">{WORKSPACE_COPY[suggested].label}</span>
          {manualState ? " (overridden below)" : ""} · {dueToday} task{dueToday === 1 ? "" : "s"} due today
        </p>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATE_BUTTONS.map((s) => {
          const active = activeState === s;
          const accent = STATE_ACCENT[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => handleStart(s)}
              className={`rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active ? "" : "border-line bg-surface hover:bg-surface-2"
              }`}
              style={active ? { borderColor: accent, borderWidth: 2, background: `${accent}12` } : undefined}
            >
              <div className="text-sm font-bold" style={{ color: active ? accent : "var(--ink)" }}>
                {WORKSPACE_COPY[s].label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">{WORKSPACE_COPY[s].bullets[0]}</p>
            </button>
          );
        })}
      </div>

      <Card className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: `${STATE_ACCENT[activeState]}18`, color: STATE_ACCENT[activeState] }}
            >
              {WORKSPACE_COPY[activeState].label.charAt(0)}
            </span>
            <div>
              <div className="text-sm font-bold text-ink">{WORKSPACE_COPY[activeState].label} mode active</div>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                {WORKSPACE_COPY[activeState].bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
          {isSelf ? (
            openSession ? (
              <Button variant="secondary" size="sm" onClick={handleEnd} disabled={isPending}>
                {pendingMode === "ending" ? "Ending…" : "End session"}
              </Button>
            ) : (
              <Chip tone="neutral">{pendingMode ? "Starting…" : "No session open"}</Chip>
            )
          ) : null}
        </div>
        {error ? <p className="mt-3 text-xs text-risk-critical">{error}</p> : null}
        {lastSummary ? (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-soft">
            Session ended — {lastSummary.tasksCompleted} task{lastSummary.tasksCompleted === 1 ? "" : "s"} completed,{" "}
            {lastSummary.notificationsSuppressed} notification{lastSummary.notificationsSuppressed === 1 ? "" : "s"}{" "}
            held and now released to your inbox.
          </p>
        ) : null}
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">Today&apos;s timeline — real clocked time</h2>
      <Card>
        {timeline.length === 0 ? (
          <p className="text-sm text-ink-mute">No clock-in recorded yet today.</p>
        ) : (
          <>
            <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
              {timeline.map((block, i) => (
                <div
                  key={i}
                  title={`${fmtMinutes(block.startMin)}–${fmtMinutes(block.endMin)} · ${BLOCK_LABEL[block.kind]}`}
                  className="flex-1"
                  style={{ background: BLOCK_COLOR[block.kind], flexGrow: block.endMin - block.startMin }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {(["worked", "break", "gap"] as FocusBlock["kind"][]).map((kind) => (
                <div key={kind} className="flex items-center gap-1.5 text-xs text-ink-mute">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BLOCK_COLOR[kind] }} />
                  {BLOCK_LABEL[kind]}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
