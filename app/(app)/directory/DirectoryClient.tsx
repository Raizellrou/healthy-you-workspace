"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BAND_COLOR, BAND_INK, BAND_LABEL, BAND_ORDER } from "@/lib/burnout-bands";
import type { Employee } from "@/types/employee";
import type { BurnoutBand } from "@/types/burnout";

const TEAM_PALETTE = ["#6F49A6", "#FFB5C5", "#87CEEB", "#A8D592", "#C7A2E5", "#FF8C73"];

/** One line of context per shelf, in the same voice as the burnout page's
 *  own composite-score description (app/(app)/burnout/page.tsx). Mood isn't
 *  usable here: mood_checkins is select-own-only at the RLS level (see
 *  supabase/migrations/0003_fix_write_policies.sql), so risk band is the
 *  privacy-safe per-person signal to group and color by instead — the same
 *  bandV2 the Burnout Risk Analytics page shows, computed server-side in
 *  page.tsx via buildBurnoutV2, so the two screens' counts agree. */
const BAND_DESCRIPTION: Record<BurnoutBand, string> = {
  low: "Composite burnout score in the healthy range. Nothing currently elevated.",
  medium: "A signal or two is elevated. Worth keeping an eye on.",
  high: "Multiple signals elevated. A workload check-in is worth considering.",
  critical: "Composite score in the critical range. Needs prompt attention.",
};

export function DirectoryClient({
  employees,
  bandByEmployee,
}: {
  employees: Employee[];
  bandByEmployee: Record<string, BurnoutBand>;
}) {
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string | "All">("All");
  const [collapsedBands, setCollapsedBands] = useState<Set<BurnoutBand>>(new Set());
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const shelvesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPersonId) return;
    function onPointerDown(e: MouseEvent) {
      if (shelvesRef.current && !shelvesRef.current.contains(e.target as Node)) setOpenPersonId(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPersonId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPersonId]);

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

  const shelves = useMemo(() => {
    const byBand = new Map<BurnoutBand, Employee[]>(BAND_ORDER.map((band) => [band, []]));
    for (const e of filtered) {
      const band = bandByEmployee[e.id] ?? "low";
      byBand.get(band)!.push(e);
    }
    return BAND_ORDER.map((band) => ({ band, people: byBand.get(band)! })).filter((shelf) => shelf.people.length > 0);
  }, [filtered, bandByEmployee]);

  function toggleBand(band: BurnoutBand) {
    setCollapsedBands((prev) => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });
  }

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

      {query || teamFilter !== "All" ? (
        <div className="mb-3 text-xs text-ink-mute">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
          {teamFilter !== "All" ? ` in ${teamFilter}` : ""}
          {query ? ` matching “${query}”` : ""}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState icon="users" message={`No employees match “${query}”.`} />
      ) : (
        <div ref={shelvesRef} className="space-y-3">
          {shelves.map(({ band, people }) => {
            const open = !collapsedBands.has(band);
            const fill = BAND_COLOR[band];
            const ink = BAND_INK[band];
            return (
              <div key={band} className="overflow-hidden rounded-2xl border border-line shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleBand(band)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  style={{ background: fill, color: ink }}
                >
                  <span className="text-sm font-bold">
                    {BAND_LABEL[band]} risk · {people.length} {people.length === 1 ? "person" : "people"}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {open ? (
                  <div className="p-4" style={{ background: `${fill}14` }}>
                    <p className="mb-3 text-xs text-ink-mute">{BAND_DESCRIPTION[band]}</p>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {people.map((e) => {
                        const personOpen = openPersonId === e.id;
                        return (
                          <div key={e.id} className="relative">
                            {/* Back tab peeking out above-left, like a folder
                                sitting behind the front one — depth cue
                                instead of a bare rectangle. */}
                            <span
                              aria-hidden="true"
                              className="absolute -top-2 left-2 h-2.5 w-9 rounded-t-md"
                              style={{ background: fill, opacity: 0.85 }}
                            />
                            <button
                              type="button"
                              onClick={() => setOpenPersonId(personOpen ? null : e.id)}
                              aria-expanded={personOpen}
                              className="relative flex h-16 w-full items-center gap-2 rounded-lg rounded-tl-sm px-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                              style={{ background: fill, color: ink }}
                            >
                              <Avatar name={e.name} color={e.avatarColor} size={28} />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold">{e.name}</div>
                                <div className="truncate text-[11px] opacity-80">{e.role}</div>
                              </div>
                            </button>

                            {personOpen ? (
                              <div
                                role="tooltip"
                                className="absolute left-0 top-full z-20 mt-2 w-52 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg"
                              >
                                <div className="font-semibold text-ink">{e.name}</div>
                                <div className="mt-0.5 text-ink-soft">{e.role}</div>
                                <div className="mt-2 flex items-center gap-1.5 text-ink-mute">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: fill }} aria-hidden="true" />
                                  {e.team} · {BAND_LABEL[band]} risk
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
