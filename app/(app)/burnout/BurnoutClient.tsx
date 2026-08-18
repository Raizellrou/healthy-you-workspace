"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { BandChip } from "@/components/burnout/BandChip";
import { ScoreBar } from "@/components/burnout/ScoreBar";
import { Sparkline } from "@/components/burnout/Sparkline";
import { computeBurnout, dominantDriver } from "@/lib/burnout";
import type { BurnoutHistoryPoint } from "@/lib/supabase/queries";
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
const BAND_COLOR: Record<BurnoutBand, string> = {
  low: "#87D380",
  medium: "#6F49A6",
  high: "#FFD700",
  critical: "#FF8C73",
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

export function BurnoutClient({
  employees,
  historyByEmployee,
}: {
  employees: Employee[];
  historyByEmployee: Record<string, BurnoutHistoryPoint[]>;
}) {
  const rows = useMemo<Row[]>(
    () => employees.map((employee) => ({ employee, scores: computeBurnout(employee) })),
    [employees]
  );

  const bandCounts = useMemo(() => {
    const counts: Record<BurnoutBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    rows.forEach((r) => counts[r.scores.band]++);
    return counts;
  }, [rows]);

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team))).sort(), [employees]);

  const [teamFilter, setTeamFilter] = useState<string | "All">("All");
  const [activeBand, setActiveBand] = useState<BurnoutBand | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const matchesBand = !activeBand || r.scores.band === activeBand;
      const matchesTeam = teamFilter === "All" || r.employee.team === teamFilter;
      return matchesBand && matchesTeam;
    });
    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, activeBand, teamFilter, sortKey, sortDir]);

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
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["All", ...teams] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={teamFilter === t}
            onClick={() => setTeamFilter(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              teamFilter === t ? "bg-ink text-white" : "border border-line text-ink-mute hover:bg-surface-2"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:inline-block" aria-hidden="true" />
        {BANDS.map((band) => (
          <button
            key={band}
            type="button"
            aria-pressed={activeBand === band}
            onClick={() => setActiveBand((cur) => (cur === band ? null : band))}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeBand === band
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {BAND_LABEL[band]}
            <span className="ml-1.5 font-mono text-[10px] text-ink-mute">{bandCounts[band]}</span>
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 items-start gap-5 ${selected ? "lg:grid-cols-[1fr_320px]" : ""}`}>
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
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: BAND_COLOR[row.scores.band] }}>
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
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={selected.employee.name} color={selected.employee.avatarColor} size={44} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{selected.employee.name}</div>
              <div className="truncate text-xs text-ink-mute">
                {selected.employee.role} · {selected.employee.team}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <div className="rounded-lg bg-surface-2 px-4 py-3 text-center">
              <div className="text-2xl font-bold" style={{ color: BAND_COLOR[selected.scores.band] }}>
                {Math.round(selected.scores.composite)}
              </div>
              <div className="text-[10px] text-ink-mute">Burnout score</div>
            </div>
            <BandChip band={selected.scores.band} />
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute">
              14-day trend
            </div>
            <Sparkline
              values={(historyByEmployee[selected.employee.id] ?? []).map((p) => p.composite)}
              stroke={BAND_COLOR[selected.scores.band]}
              filled
              width={272}
              height={56}
            />
          </div>

          <div className="mt-5">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">
              Contributing factors
            </div>
            <div className="space-y-3">
              <ScoreBar label="Work streak" value={selected.scores.streak} />
              <ScoreBar label="Meeting load" value={selected.scores.meeting} />
              <ScoreBar label="Off-hours messages" value={selected.scores.offHours} />
              <ScoreBar label="Time since PTO" value={selected.scores.pto} />
            </div>
          </div>

          {selected.scores.band === "high" || selected.scores.band === "critical" ? (
            <div className="mt-5 rounded-lg border border-risk-critical/25 bg-risk-critical/10 p-3">
              <div className="mb-1 text-xs font-bold text-risk-critical">Recommended action</div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {selected.scores.band === "critical"
                  ? `Consider a 1:1 check-in this week — driven mainly by ${dominantDriver(selected.scores).label}.`
                  : `Monitor closely and encourage a short break — driven mainly by ${dominantDriver(selected.scores).label}.`}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}
      </div>
    </div>
  );
}
