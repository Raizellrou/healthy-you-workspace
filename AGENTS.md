<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

This warning is not hypothetical for this project: the auth middleware file was
renamed from `middleware.ts` to `proxy.ts` (and the exported function from
`middleware` to `proxy`) in this Next.js version, and that rename was only
caught by reading the bundled docs above, not from training data. Check
`node_modules/next/dist/docs/` before assuming any Next.js API you remember
still works the same way here.

# AxionHR — Agent Instructions

## Project Purpose

AxionHR is an HR wellbeing dashboard for a ~24-person organization. It provides
several pillar screens — Dashboard, Directory, Attendance, Burnout Risk Analytics,
Nudges, Track the Mood, Right to Disconnect, Kudos, and Focus Mode, with more
being added over time. `lib/pillars.ts`'s `PILLARS` array is the authoritative,
current list — don't rely on a hardcoded count or name list in this doc, since
it will drift as pillars are added.

It is being converted from an in-memory client-only prototype into a Supabase-backed
application with real authentication, server-side data fetching, and Server Actions.

## Technology Stack

- **Framework**: Next.js 16.3.1 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS v4 (`@theme inline`, custom design tokens in `app/globals.css`)
- **Font**: Inter (Google Fonts, loaded in `app/layout.tsx`)
- **Database**: Supabase (PostgreSQL 17), **hosted project** — not a local
  Supabase CLI instance. `supabase/config.toml` exists from an early
  `supabase init` but was never followed up with `supabase start`; the CLI
  is not part of this project's actual workflow. See Development Workflow
  below.
- **Auth**: Supabase Auth (email/password, JWT, refresh tokens)
- **Icons**: Hand-built inline SVG sprite (`components/icons/IconSprite.tsx`), no icon library
- **Drag & Drop**: `@dnd-kit` installed but not yet wired into any visible page
- **Lint**: ESLint 9 (flat config)

There is **no external UI library**. All UI primitives live in `components/ui/`.

## Architecture

Hybrid Server/Client Component pattern:

- **Server Components** (pages in `app/(app)/*/page.tsx`) fetch data via
  `lib/supabase/queries.ts` and render static shells.
- **Client Components** (`*Client.tsx`) handle interactivity: sorting, filtering,
  selection, timers, form state.
- **Server Actions** (`app/(app)/*/actions.ts`) perform authenticated writes.
  They always derive identity from `getCurrentEmployeeId()` — never from
  client-supplied values.
- **Auth** is enforced by `proxy.ts` (Next.js 16 Proxy) at the edge, with RLS
  as the database-side safety net.
- **Nudge simulation** is fully client-side, session-local via React Context
  (`NudgeProvider` in `app/(app)/layout.tsx`).

Data flow: Server Component → `lib/supabase/queries.ts` → props → Client Component.
Writes: Client Component → Server Action → `getCurrentEmployeeId()` → Supabase.

## Directory Structure

```
app/
  layout.tsx                    # Root HTML shell
  page.tsx                      # / → redirects to /dashboard
  globals.css                   # Design tokens, keyframes, reduced-motion
  login/                        # Auth entry point
  (app)/                        # Authenticated route group
    layout.tsx                  # App shell: Sidebar + NudgeProvider + ToastDock
    dashboard/, directory/, attendance/, burnout/, nudges/, mood/,
    boundary/, kudos/, focus/   # One folder per pillar (page + Client + actions)

components/
  shell/                        # Sidebar, nav items
  ui/                           # Card, Button, Chip, Avatar, Stat, Switch, PageHead, EmptyState
  icons/                        # IconSprite + Icon
  burnout/                      # BandChip, ScoreBar, Sparkline
  nudges/                       # NudgeToastCard, ToastDock
  mood/                         # Axolotl mood avatar components

lib/
  supabase/
    client.ts                   # Browser Supabase client
    server.ts                   # Server Supabase client (cookie-based)
    queries.ts                  # Central data-access layer
  burnout.ts                    # computeBurnout, dominantDriver, sparkline math
  boundary.ts                   # evaluateBoundary, nextWorkStart, isWorkday
  constants.ts                  # DAYS, NUDGE_*, MOODS, KUDOS_*, FOCUS_TIMELINE
  employees.ts                  # Legacy fixture data, no longer read by any page —
                                 #   every pillar now fetches real employees via
                                 #   queries.ts. The only live export still in use
                                 #   is initials(), imported by components/ui/Avatar.tsx.
  nudge-context.tsx             # NudgeProvider + useNudges
  pillars.ts                    # PILLARS array (dashboard cards)
  time.ts                       # parseTimeInput, fmtClock

supabase/
  config.toml                   # Leftover `supabase init` scaffold — describes a
                                 #   local instance this project doesn't actually run
  migrations/                   # Schema + RLS migrations, applied by hand in the
                                 #   hosted project's SQL Editor (see Development
                                 #   Workflow) — numbered sequentially, currently
                                 #   through 0007

scripts/
  seed.ts                       # Creates demo auth users, links to employees.auth_user_id

proxy.ts                        # Next.js Proxy — auth guard + session refresh
```
## Coding Conventions

- **TypeScript strict**: `strict: true` in `tsconfig.json`.
- **Path aliases**: Use `@/` for imports (e.g., `@/lib/...`, `@/components/...`).
- **Server/Client demarcation**: `"use server"` or `"use client"` at the top of files.
- **Colocation**: Route folders contain `page.tsx`, optional `*Client.tsx`, and optional `actions.ts`.
- **Data access**: Centralized in `lib/supabase/queries.ts`. Pages import from there,
  not directly from Supabase.
- **Error handling**: Server Actions return `{ ok: boolean, error?: string }`.
  Do not throw to the client.
- **No external UI library**: All components are built in `components/ui/`.
- **Design tokens**: Use CSS custom properties from `app/globals.css` via Tailwind
  classes (e.g., `bg-surface`, `text-ink`, `border-line`).

## Naming Conventions

- **Components / Types**: `PascalCase`
- **Functions / Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `page.tsx`, `layout.tsx`, `actions.ts`, `*Client.tsx`
- **Routes**: lowercase path segments (e.g., `/burnout`, `/track-the-mood`)

## Testing Requirements

There is **no automated test suite** currently.

Before making changes, verify:
1. `npx tsc --noEmit` — type check passes
2. `npm run lint` — ESLint passes
3. `npm run build` — production build succeeds

When adding tests, prefer Vitest. Priority targets:
- Pure functions in `lib/boundary.ts`, `lib/burnout.ts`, `lib/time.ts`
- Server Actions in `app/(app)/*/actions.ts`
- Client Components in `components/ui/`

## Build / Run Commands

```bash
npm install
npm run dev      # Next.js dev server on http://localhost:3000
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run seed     # Creates 24 demo auth users (requires .env.local)
```

## Database Rules

- Never edit a migration file once it has been applied to the database,
  regardless of its number. Applied migrations happen to be 0001–0007 as of
  this writing, but that range will keep growing — the rule is about
  *applied* status, not a fixed range that needs to be remembered and
  bumped. If a change is needed after a migration has already been applied
  (including one applied earlier in the same session), write a new,
  higher-numbered migration instead of touching the old one. This project
  has already done that three times — `0003_fix_write_policies.sql`,
  `0004_kudos_flagged.sql`, and `0005_kudos_type_constraint.sql` each fixed
  a bug found in a migration applied just before it. Treat that as the
  normal way schema issues get corrected here, not an exception.
- New schema changes: create new numbered migration files in
  `supabase/migrations/`.
- RLS is enabled on all tables. Respect existing policies; do not disable RLS.
- `employees.auth_user_id` is the link to Supabase Auth. Do not break this linkage.
- `mood_checkins` has a unique constraint on `(employee_id, date)`. One check-in per day.
- `mood_checkins` team aggregates are served by `get_team_mood_aggregate()`
  RPC, which returns null when fewer than 3 people checked in
  (anti-de-anonymization).

## Authentication Rules

- Auth is Supabase Auth (email/password). No other providers are configured.
- `proxy.ts` guards all routes except `/login`. It refreshes the session on every request.
- Server Actions must resolve identity via `getCurrentEmployeeId()` from
  `lib/supabase/queries.ts`. Never accept `employee_id` from client input for writes.
- `getCurrentEmployeeId()` looks up employees by `auth_user_id = auth.uid()`.
- The logged-in user can only ever act as themselves.

## Security Requirements

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It is server-only and gitignored.
- The service-role key is used for two things: `scripts/seed.ts`, and
  short-lived, narrowly-scoped Node scripts for verifying schema/RLS
  changes — there's no working local database to test against otherwise
  (see Development Workflow). When writing one of these: scope every write
  to a specific row you just created (by id — never an unscoped filter),
  delete anything inserted purely for verification immediately after, and
  never run an unscoped `UPDATE`/`DELETE` against a real table.
- Demo password `axionhr-demo-2026` is exploration-only. This auth setup
  (no email confirmation, no password reset flow, one shared password)
  must never front a real public deployment — do not use or promote it to
  production.
- Do not disable RLS or drop existing policies.
- Secrets: `.env.local` is gitignored. Never commit secrets, and never
  print or log the full value of a key from `.env.local`.
- The `kudos` table allows any authenticated user to read rows where
  `flagged = true` (HR view). This is acceptable for a single-org demo but
  is not multi-tenant isolation.
- User-submitted text fields (kudos messages, boundary message previews,
  task titles/descriptions/comments) currently have no length limit at the
  database level. Keep this in mind if it matters for what you're building.

## Dangerous Operations — Avoid Without Explicit User Confirmation

- `supabase db reset`, `supabase link`, `supabase db push`, or any other
  Supabase CLI command that writes to a project. `supabase/config.toml`
  describes a local instance this project doesn't actually run — see
  Development Workflow. Running CLI commands against the wrong target
  risks the real hosted data.
- Any unscoped `UPDATE`/`DELETE` (no `WHERE` on a specific id) through a
  service-role script, even for cleanup.
- Editing an already-applied migration file in place (see Database Rules).
- Anything that would commit `.env.local` or print
  `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` somewhere
  an agent's output might end up shared or logged.

## Git Safety Rules

- `.env.local` is gitignored. Use `.env.local.example` as the template.
- `node_modules/`, `.next/`, `out/`, `build/`, `.vercel/` are gitignored.
- `supabase/migrations/` is tracked. Do not rewrite or delete applied migrations.
- Do not commit `SUPABASE_SERVICE_ROLE_KEY` or any API keys.

## Important Files

Do not break the contracts of these files without full context:

- `proxy.ts` — Auth middleware (all route protection)
- `lib/supabase/queries.ts` — Central data layer (`getEmployees`, `getCurrentEmployeeId`, etc.)
- `lib/supabase/server.ts` — Server-side Supabase client
- `lib/supabase/client.ts` — Browser-side Supabase client
- `app/(app)/layout.tsx` — App shell, loads employees server-side
- `lib/nudge-context.tsx` — Nudge simulation state machine (strict-mode safe)
- `lib/boundary.ts` — Pure `evaluateBoundary` function (shared by client preview and server action)
- `lib/burnout.ts` — `computeBurnout`, `dominantDriver`, sparkline math
- `scripts/seed.ts` — Demo user creation (requires service role key)

## Things Agents Must Not Modify

- `proxy.ts`
- `lib/supabase/queries.ts`
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/nudge-context.tsx`
- `lib/boundary.ts`
- `lib/burnout.ts`
- Any already-applied migration in `supabase/migrations/` (see Database Rules)
- `.env.local`
- `AGENTS.md` and `CLAUDE.md` (these files themselves) — unless the user
  explicitly asks for a documentation change, as opposed to a code change

## Development Workflow

This project runs against a **hosted** Supabase project, not a local one.
`supabase/config.toml` exists from an early `supabase init` but was never
followed up with `supabase start`, and the Supabase CLI is not installed or
part of the actual workflow — `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`
points at the real hosted project.

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from the hosted project's API settings.
3. `npm run seed` — creates 24 demo auth users linked to the `employees`
   table. The `employees` table must already be pre-populated with 24 rows
   before running this.
4. `npm run dev` — open http://localhost:3000

**Schema changes**: there is no local database to run migrations against
automatically. The actual process used throughout this project: write a new
numbered migration file in `supabase/migrations/`, present its SQL to the
user to run in the hosted project's SQL Editor (Supabase Dashboard), then
verify it actually took effect with a narrowly-scoped Node script using the
service-role key (see Security Requirements). Never assume a migration has
been applied just because the file exists in the repo — confirm it. 