"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { computeBurnout } from "@/lib/burnout";
import { FOCUS_TIMELINE, WORKSPACE_COPY, type TimelineKind, type WorkspaceState } from "@/lib/constants";
import type { Employee } from "@/types/employee";

const STATE_BUTTONS: WorkspaceState[] = ["standard", "focus", "calm"];

const STATE_ACCENT: Record<WorkspaceState, string> = {
  standard: "#6F49A6",
  focus: "#87CEEB",
  calm: "#A8D592",
};

const TIMELINE_TONE: Record<TimelineKind, ChipTone> = {
  meeting: "brand",
  deep_work: "success",
  gap: "neutral",
  high_stress: "critical",
};

function autoSuggest(employee: Employee): WorkspaceState {
  const band = computeBurnout(employee).band;
  return band === "high" || band === "critical" ? "focus" : "standard";
}

export function FocusClient({ employees }: { employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const [manualState, setManualState] = useState<WorkspaceState | null>(null);
  const [alternateState, setAlternateState] = useState<WorkspaceState>("focus");

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const suggested = autoSuggest(employee);
  const activeState = manualState ?? suggested;

  const [prevActiveState, setPrevActiveState] = useState(activeState);
  if (activeState !== prevActiveState) {
    setPrevActiveState(activeState);
    if (activeState !== "standard") setAlternateState(activeState);
  }

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    setManualState(null);
  }

  return (
    <div>
      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
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
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-mute">
              Suggested: <span className="font-medium text-ink-soft">{WORKSPACE_COPY[suggested].label}</span>
              {manualState ? " (overridden below)" : ""}
            </p>
          </div>

          <div className="flex gap-2">
            {STATE_BUTTONS.map((s) => {
              const active = activeState === s;
              const accent = STATE_ACCENT[s];
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setManualState(s)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
                  }`}
                  style={active ? { borderColor: accent, background: `${accent}18`, color: accent } : undefined}
                >
                  {WORKSPACE_COPY[s].label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card style={activeState === "standard" ? { borderColor: STATE_ACCENT.standard } : undefined}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">{WORKSPACE_COPY.standard.label}</div>
            {activeState === "standard" ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${STATE_ACCENT.standard}18`, color: STATE_ACCENT.standard }}
              >
                Active now
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {WORKSPACE_COPY.standard.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden="true">•</span>
                {b}
              </li>
            ))}
          </ul>
        </Card>

        <Card style={activeState === alternateState ? { borderColor: STATE_ACCENT[alternateState] } : undefined}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">{WORKSPACE_COPY[alternateState].label}</div>
            {activeState === alternateState ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: `${STATE_ACCENT[alternateState]}18`, color: STATE_ACCENT[alternateState] }}
              >
                Active now
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {WORKSPACE_COPY[alternateState].bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden="true">•</span>
                {b}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-ink">Today&apos;s timeline</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {FOCUS_TIMELINE.map((block, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-3">
            <div className="text-xs font-mono text-ink-mute">
              {block.start}–{block.end}
            </div>
            <div className="mt-2">
              <Chip tone={TIMELINE_TONE[block.kind]}>{block.label}</Chip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
