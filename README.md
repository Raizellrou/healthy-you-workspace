# AxionHR

A from-scratch Next.js port of the AxionHR HR wellbeing prototype: a single-page,
client-only demo with one sidebar shell and nine screens (Dashboard, Directory,
Attendance, Burnout Risk Analytics, Nudges, Track the Mood, Boundary/Right to
Disconnect, Kudos, Focus Mode). No backend, no persistence, no external
dependencies — everything is in-memory React state that resets on reload.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. Real routes per pillar
(`/dashboard`, `/directory`, `/attendance`, `/burnout`, `/nudges`, `/mood`,
`/boundary`, `/kudos`, `/focus`); `/` redirects to `/dashboard`.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

- `app/*/page.tsx` — one route per pillar, plus client components colocated
  alongside each (`*Client.tsx`) for interactive pieces.
- `app/layout.tsx` — shell: sidebar + main slot + toast dock, wrapped in the
  Nudges context provider.
- `app/globals.css` — design tokens (light/dark via `prefers-color-scheme` and
  an explicit `data-theme` override) exposed to Tailwind via `@theme inline`,
  plus shared keyframes.
- `components/shell` — `Sidebar` (collapses to a horizontal scroll bar under
  `md`), nav item list.
- `components/ui` — `Card`, `Chip`, `Button`, `Switch`, `Stat`, `PageHead`,
  `EmptyState`, `Avatar`.
- `components/icons` — a hand-built inline SVG `<symbol>` sprite (16 icons,
  stroke-based, no icon library) + an `Icon` component.
- `components/burnout`, `components/nudges`, `components/mood` — pillar-specific
  pieces (score bars, sparkline, toast card/dock, the Axolotl component).
- `lib/employees.ts` — the 8-employee roster + avatar color assignment (fixed
  8-color palette by roster index, not hashed by name).
- `lib/burnout.ts` — `computeBurnout`, `dominantDriver`, `trendFor` (seeded
  sparkline fabrication), `sparkPath`.
- `lib/boundary.ts` — `evaluateBoundary` (the single decision function used by
  both the live preview and the actual send), `nextWorkStart`, `isWorkday`.
- `lib/time.ts` — `parseTimeInput`, `fmtClock`.
- `lib/nudge-context.tsx` — the Nudges simulation, provided above route level
  (session timer, log, toast state, unseen badge, title flash, Notification
  permission) since with real routing "another panel" becomes "another route."
- `lib/constants.ts` — days, nudge metadata, moods, kudos tags, focus timeline.
- `types/*.ts` — shared interfaces.

## Notes on a few implementation choices

The source spec didn't pin down some purely cosmetic details, so these were
decided during the build rather than left as open questions:

- **Mood axolotl palette** — the five mood colors (body/light/frill/line per
  mood) and the specific face-mark shapes per mood aren't specified beyond
  "hand-built pixel-art," so a five-color palette and a distinct eye/mouth
  style per mood were designed fresh.
- **Team trend / burnout sparkline "end" values** — `trendFor(seed, end)` is
  generic per the spec; Burnout detail passes the employee's composite score,
  Mood team trends pass the team's fabricated average scaled to 0–100.
- **Boundary default message** — the spec calls for the *default state* to
  demonstrate the "warned" path (default recipient is Burnout Bob, on PTO),
  which requires a non-empty starting message; a short filler message is
  pre-filled for that reason.

## Verification

`tsc --noEmit`, `eslint .`, and `next build` all pass clean. All nine screens
were exercised in-browser against the feature spec (search/filter, sort +
selection persistence on Burnout, the Nudges session timer firing and
resolving nudges via Snooze/Done, the mood one-time pick and reset, the full
Boundary decision matrix — blocked/warned/delivered/delayed, including the
Friday-evening-skips-the-weekend case — Kudos submit + progress cap, and the
Focus auto-suggestion/manual-override interaction).

One real bug was caught and fixed during verification: the Nudges session
timer used to call side-effecting `setState` calls from inside another
`setState` updater function, which React's Strict Mode double-invokes in dev
to catch exactly this kind of impurity — it caused two nudges to fire (and
log) per 50-minute cycle instead of one. Fixed by moving the counters to refs
and keeping the `setState` updaters pure.
