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

const TIMELINE_COLOR: Record<TimelineKind, string> = {
  meeting: "#87CEEB",
  deep_work: "#6F49A6",
  gap: "#A8D592",
  high_stress: "#FF8C73",
};

function autoSuggest(employee: Employee): WorkspaceState {
  const band = computeBurnout(employee).band;
  return band === "high" || band === "critical" ? "focus" : "standard";
}

export function FocusClient({ employees }: { employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const [manualState, setManualState] = useState<WorkspaceState | null>(null);

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const suggested = autoSuggest(employee);
  const activeState = manualState ?? suggested;

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    setManualState(null);
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
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-mute">
          Suggested: <span className="font-medium text-ink-soft">{WORKSPACE_COPY[suggested].label}</span>
          {manualState ? " (overridden below)" : ""}
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
              onClick={() => setManualState(s)}
              className={`rounded-xl border p-4 text-left transition-colors ${
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
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">Today&apos;s timeline</h2>
      <Card>
        <div className="flex h-8 gap-0.5 overflow-hidden rounded-lg">
          {FOCUS_TIMELINE.map((block, i) => (
            <div
              key={i}
              title={`${block.start}–${block.end} · ${block.label}`}
              className="flex-1"
              style={{ background: TIMELINE_COLOR[block.kind] }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {(["meeting", "deep_work", "gap", "high_stress"] as TimelineKind[]).map((kind) => (
            <div key={kind} className="flex items-center gap-1.5">
              <Chip tone={TIMELINE_TONE[kind]} className="capitalize">
                {kind.replace("_", " ")}
              </Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
