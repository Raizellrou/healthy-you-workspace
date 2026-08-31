"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BandChip } from "@/components/burnout/BandChip";
import { computeBurnout } from "@/lib/burnout";
import type { Employee } from "@/types/employee";

/**
 * Team identity hues. These are used only as a dot and a card border accent
 * — never as a text colour, and never as a fill behind text.
 *
 * They used to be both: the team chip rendered the hue as text on a 12%
 * tint of itself (1.66:1 for Engineering, 1.67:1 for Sales) and the active
 * filter button rendered white text on the raw hue, which for the pastel
 * entries was worse still. A hex chosen in JS also cannot respond to the
 * theme, so any text built from one is legible in at most one of them.
 *
 * Colour as a dot beside neutral text is the pattern NavPanel already uses
 * for projects, and it works on either ground.
 */
const TEAM_PALETTE = ["#6F49A6", "#E0578A", "#3D8FD1", "#5BA150", "#9B6FD4", "#D96A4A"];

export function DirectoryClient({
  employees,
  bandVisibleIds,
}: {
  employees: Employee[];
  /** Ids whose burnout band this viewer may see — computed with canSee() in
   *  page.tsx. Everyone still appears in the directory; only the band is
   *  withheld. */
  bandVisibleIds: Set<string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search and team filter live in the URL so a filtered view can be linked,
  // bookmarked and survive a reload — the two things an HR user would
  // actually want to send to a manager. Held in local state as well so
  // typing stays responsive, with the URL written behind a debounce rather
  // than once per keystroke.
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const teamFilter = searchParams.get("team") ?? "All";

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (query.trim()) next.set("q", query);
      else next.delete("q");
      if (next.toString() !== searchParams.toString()) {
        router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, pathname, router, searchParams]);

  function setTeamFilter(team: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (team === "All") next.delete("team");
    else next.set("team", team);
    router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
  }

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
            const color = teamColor.get(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTeamFilter(t)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-transparent bg-brand-soft text-brand-ink"
                    : "border-line text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {color ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                ) : null}
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                  {e.team}
                </span>
                {bandVisibleIds.has(e.id) ? <BandChip band={scores.band} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
