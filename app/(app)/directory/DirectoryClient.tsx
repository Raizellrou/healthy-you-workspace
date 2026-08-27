"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BandChip } from "@/components/burnout/BandChip";
import { computeBurnout } from "@/lib/burnout";
import type { Employee } from "@/types/employee";

const TEAM_PALETTE = ["#6F49A6", "#FFB5C5", "#87CEEB", "#A8D592", "#C7A2E5", "#FF8C73"];

export function DirectoryClient({ employees }: { employees: Employee[] }) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string | "All">("All");

  const teams = useMemo(() => Array.from(new Set(employees.map((e) => e.team))).sort(), [employees]);
  const teamColor = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((t, i) => map.set(t, TEAM_PALETTE[i % TEAM_PALETTE.length]));
    return map;
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQuery =
        !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || e.team.toLowerCase().includes(q);
      const matchesTeam = teamFilter === "All" || e.team === teamFilter;
      return matchesQuery && matchesTeam;
    });
  }, [employees, query, teamFilter]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="4" />
            <path d="M9.5 9.5L12.5 12.5" />
          </svg>
          <label className="sr-only" htmlFor="directory-search">
            Search employees
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, or team…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-mute focus:border-brand"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...teams] as const).map((t) => {
            const active = teamFilter === t;
            const color = t === "All" ? "#6F49A6" : teamColor.get(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTeamFilter(t)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={
                  active
                    ? { background: color, color: "#FFFFFF" }
                    : { border: "1px solid var(--line)", color: "var(--ink-mute)" }
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 text-xs text-ink-mute">
        {filtered.length} {filtered.length === 1 ? "person" : "people"}
        {teamFilter !== "All" ? ` in ${teamFilter}` : ""}
        {query ? ` matching “${query}”` : ""}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="users" message={`No employees match “${query}”.`} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((e) => {
            const scores = computeBurnout(e);
            const color = teamColor.get(e.team) ?? "#6F49A6";
            return (
              <div
                key={e.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4 text-center transition-colors hover:border-[--card-accent]"
                style={{ ["--card-accent" as string]: color }}
              >
                <Avatar name={e.name} color={e.avatarColor} size={48} />
                <div>
                  <div className="text-sm font-semibold text-ink">{e.name}</div>
                  <div className="mt-0.5 text-xs text-ink-mute">{e.role}</div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: `${color}1F`, color }}
                >
                  {e.team}
                </span>
                <BandChip band={scores.band} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
