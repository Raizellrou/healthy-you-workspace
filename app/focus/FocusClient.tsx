"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { computeBurnout } from "@/lib/burnout";
import { FOCUS_TIMELINE, WORKSPACE_COPY, type TimelineKind, type WorkspaceState } from "@/lib/constants";
import type { Employee } from "@/types/employee";

const STATE_BUTTONS: WorkspaceState[] = ["standard", "focus", "calm"];

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
            {STATE_BUTTONS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={activeState === s}
                onClick={() => setManualState(s)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  activeState === s
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-2"
                }`}
              >
                {WORKSPACE_COPY[s].label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">{WORKSPACE_COPY.standard.label}</div>
            {activeState === "standard" ? <Chip tone="brand">Active now</Chip> : null}
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

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink">{WORKSPACE_COPY[alternateState].label}</div>
            {activeState === alternateState ? <Chip tone="brand">Active now</Chip> : null}
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
