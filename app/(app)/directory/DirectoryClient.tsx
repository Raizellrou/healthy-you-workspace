"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { BAND_FILL, BAND_ON_FILL, BAND_LABEL, BAND_ORDER } from "@/lib/burnout-bands";
import type { Employee } from "@/types/employee";
import type { BurnoutBand } from "@/types/burnout";

/**
 * Team identity hues. Used only as a dot and a card border accent — never
 * as a text colour, never as a fill behind text.
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

/** One line of context per shelf, in the same voice as the burnout page's
 *  own composite-score description (app/(app)/burnout/page.tsx). Mood isn't
 *  usable here: mood_checkins is select-own-only at the RLS level (see
 *  supabase/migrations/0003_fix_write_policies.sql), so risk band is the
 *  privacy-safe per-person signal to group and colour by instead — the same
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
  bandVisibleIds,
}: {
  employees: Employee[];
  bandByEmployee: Record<string, BurnoutBand>;
  /** Ids whose burnout band this viewer may see — computed with canSee() in
   *  page.tsx. Everyone still appears in the directory; only those outside
   *  this set are held back from the band-shelf grouping below and rendered
   *  in the flat "Other colleagues" section instead, with no band shown. */
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
  const [collapsedBands, setCollapsedBands] = useState<Set<BurnoutBand>>(new Set());
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const shelvesRef = useRef<HTMLDivElement>(null);

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

  // Split before shelving: only a person whose band this viewer may see
  // (bandVisibleIds) gets grouped by their real band. Everyone else renders
  // in the flat section below, unband, un-coloured — the shelf itself is a
  // severity signal, so a person can't be placed on one without disclosing
  // their band by position alone, even with the chip removed.
  const visibleFiltered = useMemo(() => filtered.filter((e) => bandVisibleIds.has(e.id)), [filtered, bandVisibleIds]);
  const otherFiltered = useMemo(() => filtered.filter((e) => !bandVisibleIds.has(e.id)), [filtered, bandVisibleIds]);

  const shelves = useMemo(() => {
    const byBand = new Map<BurnoutBand, Employee[]>(BAND_ORDER.map((band) => [band, []]));
    for (const e of visibleFiltered) {
      const band = bandByEmployee[e.id] ?? "low";
      byBand.get(band)!.push(e);
    }
    return BAND_ORDER.map((band) => ({ band, people: byBand.get(band)! })).filter((shelf) => shelf.people.length > 0);
  }, [visibleFiltered, bandByEmployee]);

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
        <div className="space-y-6">
          {shelves.length > 0 ? (
            <div ref={shelvesRef} className="space-y-3">
              {shelves.map(({ band, people }) => {
                const open = !collapsedBands.has(band);
                const fill = BAND_FILL[band];
                const ink = BAND_ON_FILL[band];
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
          ) : null}

          {otherFiltered.length > 0 ? (
            <div>
              <div className="mb-1 text-sm font-semibold text-ink">Other colleagues</div>
              <p className="mb-3 text-xs text-ink-mute">
                Burnout risk isn&apos;t shown here — visible only to the person themselves, their manager, or HR.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {otherFiltered.map((e) => {
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
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
