"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { BandChip } from "@/components/burnout/BandChip";
import { ScoreBar } from "@/components/burnout/ScoreBar";
import { Sparkline } from "@/components/burnout/Sparkline";
import { computeBurnout, dominantDriver } from "@/lib/burnout";
import type { Employee } from "@/types/employee";
import type { BurnoutBand, SortDirection, SortKey } from "@/types/burnout";

const BAND_ORDER: Record<BurnoutBand, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const BANDS: BurnoutBand[] = ["low", "medium", "high", "critical"];
const BAND_LABEL: Record<BurnoutBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

interface Row {
  employee: Employee;
  scores: ReturnType<typeof computeBurnout>;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Employee" },
  { key: "composite", label: "Composite" },
  { key: "band", label: "Band" },
  { key: "streakDays", label: "Streak" },
  { key: "meeting", label: "Meeting" },
  { key: "offHours", label: "Off-hours" },
  { key: "daysSincePto", label: "Since PTO" },
];

function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "name":
      return a.employee.name.localeCompare(b.employee.name);
    case "composite":
      return a.scores.composite - b.scores.composite;
    case "band":
      return BAND_ORDER[a.scores.band] - BAND_ORDER[b.scores.band];
    case "streakDays":
      return a.employee.streakDays - b.employee.streakDays;
    case "meeting":
      return a.employee.meeting - b.employee.meeting;
    case "offHours":
      return a.employee.offHoursWeekly - b.employee.offHoursWeekly;
    case "daysSincePto":
      return a.employee.daysSincePto - b.employee.daysSincePto;
  }
}

export function BurnoutClient({ employees }: { employees: Employee[] }) {
  const rows = useMemo<Row[]>(
    () => employees.map((employee) => ({ employee, scores: computeBurnout(employee) })),
    [employees]
  );

  const bandCounts = useMemo(() => {
    const counts: Record<BurnoutBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    rows.forEach((r) => counts[r.scores.band]++);
    return counts;
  }, [rows]);

  const [activeBand, setActiveBand] = useState<BurnoutBand | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const visibleRows = useMemo(() => {
    const filtered = activeBand ? rows.filter((r) => r.scores.band === activeBand) : rows;
    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, activeBand, sortKey, sortDir]);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => visibleRows[0]?.employee.id ?? null
  );

  const selected = visibleRows.find((r) => r.employee.id === selectedId) ?? visibleRows[0];

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {BANDS.map((band) => (
          <button
            key={band}
            type="button"
            aria-pressed={activeBand === band}
            onClick={() => setActiveBand((cur) => (cur === band ? null : band))}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              activeBand === band
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {BAND_LABEL[band]}
            <span className="ml-2 font-mono text-xs text-ink-mute">{bandCounts[band]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-surface-2 text-xs font-medium uppercase tracking-wide text-ink-mute">
            <tr>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th key={col.key} scope="col" className="px-4 py-3" aria-sort={ariaSort}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSort(col.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSort(col.key);
                        }
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 select-none"
                    >
                      {col.label}
                      <span aria-hidden="true" className="text-[10px] text-ink-mute">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isSelected = row.employee.id === selectedId;
              return (
                <tr
                  key={row.employee.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(row.employee.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(row.employee.id);
                    }
                  }}
                  className={`cursor-pointer border-t border-line transition-colors ${
                    isSelected ? "bg-brand-soft" : "hover:bg-surface-2"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.employee.name} color={row.employee.avatarColor} size={28} />
                      <span className="font-medium text-ink">{row.employee.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink-soft">
                    {Math.round(row.scores.composite)}
                  </td>
                  <td className="px-4 py-3">
                    <BandChip band={row.scores.band} />
                  </td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{row.employee.streakDays}d</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{row.employee.meeting.toFixed(1)}h</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{row.employee.offHoursWeekly}</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{row.employee.daysSincePto}d</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={selected.employee.name} color={selected.employee.avatarColor} size={40} />
              <div>
                <div className="font-semibold text-ink">{selected.employee.name}</div>
                <div className="text-xs text-ink-mute">
                  {selected.employee.role} · {selected.employee.team}
                </div>
              </div>
            </div>
            <BandChip band={selected.scores.band} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <ScoreBar label="Work streak" value={selected.scores.streak} />
              <ScoreBar label="Meeting load" value={selected.scores.meeting} />
              <ScoreBar label="Off-hours messages" value={selected.scores.offHours} />
              <ScoreBar label="Time since PTO" value={selected.scores.pto} />
            </div>
            <div>
              <p className="text-sm text-ink-soft">
                {selected.employee.name}&apos;s composite score is{" "}
                <span className="font-mono font-semibold text-ink">
                  {Math.round(selected.scores.composite)}
                </span>
                , driven mainly by {dominantDriver(selected.scores).label}.
              </p>
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-mute">
                  14-day trend
                </div>
                <Sparkline seed={selected.employee.name} end={selected.scores.composite} />
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
