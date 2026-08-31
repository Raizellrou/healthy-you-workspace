"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useActionToast } from "@/lib/toast-context";
import { computeBurnout } from "@/lib/burnout";
import { fmtDuration } from "@/lib/date";
import { fmtClock } from "@/lib/time";
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
  // Reflects an already-open session's real mode, instead of falling back
  // to the suggested state and only diverging once the user clicks
  // something — a reload while a session is open was showing "Standard
  // mode active" text even though the persisted session (and the
  // highlighted button) said Focus.
  //
  // useState's initializer only runs on first mount, so it alone only
  // covers a hard reload. A *soft* refresh (router.refresh() after a
  // server action — e.g. the global F keyboard shortcut in
  // CommandPalette.tsx toggling this from anywhere in the app) re-renders
  // this component with a new `openSession` prop without remounting it,
  // which left the same stale-label bug for that path. Resyncing whenever
  // the session's identity changes — a new session started, or the open
  // one ended — closes that gap too.
  const [manualState, setManualState] = useState<WorkspaceState | null>(
    currentEmployeeId && openSession ? openSession.mode : null
  );
  const [prevSessionId, setPrevSessionId] = useState(openSession?.id ?? null);
  if ((openSession?.id ?? null) !== prevSessionId) {
    setPrevSessionId(openSession?.id ?? null);
    setManualState(currentEmployeeId && openSession ? openSession.mode : null);
  }
  const [pendingMode, setPendingMode] = useState<FocusMode | "ending" | null>(null);
  const [lastSummary, setLastSummary] = useState<{ tasksCompleted: number; notificationsSuppressed: number } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [confirmStartMode, setConfirmStartMode] = useState<FocusMode | null>(null);
  const run = useActionToast();

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const suggested = autoSuggest(employee);
  const activeState = manualState ?? suggested;
  const timeline = timelineByEmployee[employeeId] ?? [];
  const dueToday = dueTodayByEmployee[employeeId] ?? 0;
  const isSelf = employeeId === currentEmployeeId;
  // `openSession` is always the signed-in viewer's own session (page.tsx
  // fetches it by currentEmployeeId, not the selected `employeeId`), so this
  // is "am I the one with a session running," independent of whose mode is
  // being viewed in the selector above.
  const isSessionActive = isSelf && Boolean(openSession);

  // Ticking elapsed-time display, same mount/interval/hydration-safe shape
  // as ClockWidget: computing from Date.now() during the initial render
  // would disagree with the server-rendered markup.
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Warn before leaving the tab while a session is genuinely open — gated on
  // isSessionActive (not "was a session open at mount") so the guard detaches
  // the instant endFocusSession resolves in this tab, not only on next load.
  useEffect(() => {
    if (!isSessionActive) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isSessionActive]);

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    setManualState(null);
  }

  function handleStart(mode: WorkspaceState) {
    setManualState(mode);
    if (!isSelf) return;
    setConfirmStartMode(mode as FocusMode);
  }

  function confirmStart() {
    const mode = confirmStartMode;
    setConfirmStartMode(null);
    if (!mode) return;
    setPendingMode(mode);
    setLastSummary(null);
    startTransition(async () => {
      await run(() => startFocusSession({ mode, trigger: "manual" }), {
        success: `${WORKSPACE_COPY[mode].label} session started.`,
      });
      setPendingMode(null);
    });
  }

  function handleEnd() {
    setConfirmEndOpen(false);
    setPendingMode("ending");
    startTransition(async () => {
      const result = await run(() => endFocusSession());
      setPendingMode(null);
      if (!result.ok) return;
      setLastSummary({
        tasksCompleted: (result as { tasksCompleted?: number }).tasksCompleted ?? 0,
        notificationsSuppressed: (result as { notificationsSuppressed?: number }).notificationsSuppressed ?? 0,
      });
    });
  }

  return (
    <div>
      <Card className="mb-5">
        <div className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-mute">Employee</div>
        {/* An employee with no reports sees exactly one option here, and a
            dropdown that cannot change anything reads as a control that is
            broken or still being built. Show the name instead; the picker
            only appears when there is genuinely something to pick. */}
        {employees.length <= 1 ? (
          <p className="text-sm font-medium text-ink">
            {employees[0]?.name ?? "You"}
            {employees[0]?.id === currentEmployeeId ? " (you)" : ""}
          </p>
        ) : (
          <>
            <label htmlFor="focus-employee" className="sr-only">
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
          </>
        )}
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
              <div className="text-sm font-bold text-ink">
                {WORKSPACE_COPY[activeState].label} mode active
                {isSessionActive && openSession ? (
                  <span className="ml-2 font-mono text-xs font-normal text-ink-mute">
                    {mounted ? fmtDuration(now - new Date(openSession.startedAt).getTime()) : "—"}
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-mute">
                {WORKSPACE_COPY[activeState].bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
          {isSelf ? (
            openSession ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmEndOpen(true)} disabled={isPending}>
                {pendingMode === "ending" ? "Ending…" : "End session"}
              </Button>
            ) : (
              <Chip tone="neutral">{pendingMode ? "Starting…" : "No session open"}</Chip>
            )
          ) : null}
        </div>
        {lastSummary ? (
          <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-soft">
            Session ended. {lastSummary.tasksCompleted} task{lastSummary.tasksCompleted === 1 ? "" : "s"} completed,{" "}
            {lastSummary.notificationsSuppressed} notification{lastSummary.notificationsSuppressed === 1 ? "" : "s"}{" "}
            held and now released to your inbox.
          </p>
        ) : null}
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">Today&apos;s timeline — real clocked time</h2>
      <Card className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {timeline.length === 0 ? (
          <p className="text-sm text-ink-mute">No clock-in recorded yet today.</p>
        ) : (
          <>
            <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
              {timeline.map((block, i) => (
                <div
                  key={i}
                  title={`${fmtClock(block.startMin)} – ${fmtClock(block.endMin)} · ${BLOCK_LABEL[block.kind]}`}
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

      <ConfirmModal
        open={confirmEndOpen}
        onClose={() => setConfirmEndOpen(false)}
        onConfirm={handleEnd}
        title="End focus session"
        message={`End your focus session? ${dueToday} task${dueToday === 1 ? "" : "s"} due today and any held notifications will be released.`}
        confirmLabel="End session"
        pending={pendingMode === "ending"}
      />

      <ConfirmModal
        open={confirmStartMode !== null}
        onClose={() => setConfirmStartMode(null)}
        onConfirm={confirmStart}
        title="Start focus session"
        message={
          confirmStartMode
            ? `Start a ${WORKSPACE_COPY[confirmStartMode].label} session? ${
                openSession ? "Your current session will end first." : ""
              }`
            : ""
        }
        confirmLabel="Start session"
        pending={isPending && pendingMode === confirmStartMode}
      />
    </div>
  );
}
