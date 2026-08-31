"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BandChip } from "@/components/burnout/BandChip";
import { ScoreBar } from "@/components/burnout/ScoreBar";
import { Sparkline } from "@/components/burnout/Sparkline";
import { ForecastCard } from "@/components/burnout/ForecastCard";
import { WhatIfSimulator } from "@/components/burnout/WhatIfSimulator";
import { InterventionPanel } from "@/components/burnout/InterventionPanel";
import { BAND_TEXT, BAND_LABEL, BAND_ORDER as BANDS } from "@/lib/burnout-bands";
import type { BurnoutHistoryPoint } from "@/lib/supabase/queries";
import type { ForecastPoint } from "@/lib/forecast";
import type { BurnoutRow } from "./page";
import type { BurnoutBand, SortDirection, SortKey } from "@/types/burnout";

/** Numeric rank for sorting the table by band, distinct from BANDS'
 *  display order (both happen to be low→critical here). */
const BAND_RANK: Record<BurnoutBand, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Employee" },
  { key: "composite", label: "Task-aware" },
  { key: "band", label: "Band" },
  { key: "streakDays", label: "Streak" },
  { key: "meeting", label: "Meeting" },
  { key: "offHours", label: "Off-hours" },
  { key: "daysSincePto", label: "Since PTO" },
];

function compareRows(a: BurnoutRow, b: BurnoutRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.employee.name.localeCompare(b.employee.name);
    case "composite":
      return a.scores.compositeV2 - b.scores.compositeV2;
    case "band":
      return BAND_RANK[a.scores.bandV2] - BAND_RANK[b.scores.bandV2];
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
  rows,
  historyByEmployee,
  forecastByEmployee,
}: {
  rows: BurnoutRow[];
  historyByEmployee: Record<string, BurnoutHistoryPoint[]>;
  forecastByEmployee: Record<string, ForecastPoint[]>;
}) {
  const bandCounts = useMemo(() => {
    const counts: Record<BurnoutBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    rows.forEach((r) => counts[r.scores.bandV2]++);
    return counts;
  }, [rows]);

  const teams = useMemo(() => Array.from(new Set(rows.map((r) => r.employee.team))).sort(), [rows]);

  // Team and band filters live in the URL so a view can be linked and
  // survives a reload — "here are the three people I mean" is the message an
  // HR user actually wants to send a manager. Sort and selection stay local:
  // they are a reading posture, not the subject of the link.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamFilter = searchParams.get("team") ?? "All";
  const bandParam = searchParams.get("band");
  const activeBand: BurnoutBand | null =
    bandParam === "low" || bandParam === "medium" || bandParam === "high" || bandParam === "critical" ? bandParam : null;

  function writeParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  }
  const setTeamFilter = (team: string) => writeParam("team", team === "All" ? null : team);
  const setActiveBand = (band: BurnoutBand | null) => writeParam("band", band);
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      const matchesBand = !activeBand || r.scores.bandV2 === activeBand;
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

  if (rows.length === 0) {
    return <EmptyState icon="users" message="No one visible in your scope yet." />;
  }

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
            onClick={() => setActiveBand(activeBand === band ? null : band)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeBand === band
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {BAND_LABEL[band]}
            <span className="ml-1.5 font-mono text-xs text-ink-mute">{bandCounts[band]}</span>
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
                      <span aria-hidden="true" className="text-xs text-ink-mute">
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
                  <td className="px-4 py-3 font-mono font-semibold" style={{ color: BAND_TEXT[row.scores.bandV2] }}>
                    {Math.round(row.scores.compositeV2)}
                    <span className="ml-1.5 font-sans text-xs font-normal text-ink-mute">
                      base {Math.round(row.scores.composite)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BandChip band={row.scores.bandV2} />
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
              <div className="text-2xl font-bold" style={{ color: BAND_TEXT[selected.scores.bandV2] }}>
                {Math.round(selected.scores.compositeV2)}
              </div>
              <div className="text-xs text-ink-mute">Task-aware score</div>
            </div>
            <div className="text-center text-xs text-ink-mute">
              base {Math.round(selected.scores.composite)}
              <div aria-hidden="true">→</div>
            </div>
            <BandChip band={selected.scores.bandV2} />
          </div>

          <div className="mt-5">
            <SectionLabel className="mb-2">14-day trend (base composite)</SectionLabel>
            <Sparkline
              values={(historyByEmployee[selected.employee.id] ?? []).map((p) => p.composite)}
              stroke={BAND_TEXT[selected.scores.bandV2]}
              filled
              width={272}
              height={56}
            />
          </div>

          <div className="mt-5">
            <ForecastCard forecast={forecastByEmployee[selected.employee.id] ?? []} />
          </div>

          <div className="mt-5">
            <SectionLabel className="mb-2.5">Base factors</SectionLabel>
            <div className="space-y-3">
              <ScoreBar label="Work streak" value={selected.scores.streak} />
              <ScoreBar label="Meeting load" value={selected.scores.meeting} />
              <ScoreBar label="Off-hours activity" value={selected.scores.offHours} />
              <ScoreBar label="Time since PTO" value={selected.scores.pto} />
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel className="mb-2.5">Task-engine factors</SectionLabel>
            <div className="space-y-3">
              <ScoreBar label="Committed task load" value={selected.scores.taskLoad} />
              <ScoreBar label="Overdue tasks" value={selected.scores.overdue} />
              <ScoreBar label="Recovery" value={selected.scores.recovery} />
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <WhatIfSimulator key={selected.employee.id} inputs={selected.inputs} extras={selected.extras} />
          </div>

          <InterventionPanel
            key={`${selected.employee.id}-intervention`}
            employeeId={selected.employee.id}
            scores={selected.scores}
            canManage={selected.canManage}
            isSelf={selected.isSelf}
            latestIntervention={selected.latestIntervention}
          />
        </Card>
      ) : null}
      </div>
    </div>
  );
}
