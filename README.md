# Petal

Petal is a Supabase-backed HR wellbeing platform for a ~24-person
organization, built from a 6-pillar hackathon concept ("AxionHR") into a real
app: real Supabase Auth, Postgres Row-Level Security as the actual privacy
boundary, Server Components/Server Actions, and a real Slack integration for
one pillar. See [PRD.md](PRD.md) for the full product spec and how it differs
from the original hackathon submission (preserved at
`Hackathon Stage 2 PRD.pdf`).

## Stack

Next.js **16.3.1** (App Router, Turbopack) + TypeScript (strict) + Tailwind
CSS v4 + Supabase (Postgres, Auth, RLS). No external UI library — every
component in `components/ui/` is hand-built, including the icon sprite.

## Pillars and screens

19 routes under `app/(app)/`, gated by `proxy.ts` (Next.js 16's Proxy
middleware) and, per-route, by role:

- **Burnout Risk Analytics** (`/burnout`) — composite score from attendance,
  task load, and off-hours signals; role-scoped (self/team/org).
- **Quick Nudge Tool** (`/nudges`) — client-side, session-local movement
  reminders.
- **Track the Mood** (`/mood`) — daily one-tap check-in; team aggregates
  hidden below 3 respondents.
- **Right to Disconnect** (`/boundary`) — schedules messages into a
  recipient's working hours; delivers for real over Slack when configured.
- **Give Me a Coffee** (`/kudos`) — weekly random buddy pairing + peer
  recognition + a quiet HR concern flag.
- **Focus Mode** (`/focus`) — adaptive workspace density, sensitized by the
  employee's own burnout band.
- **Tasks** (`/tasks`) — projects, boards, lists, calendar/timeline views,
  drag-and-drop, workload view.
- **Attendance** (`/attendance`) / **Time Off** (`/time-off`) — real
  clock-in/out and PTO requests/approvals.
- **Directory** (`/directory`) — org browser, burnout band privacy-gated per
  viewer.
- **Insights** (`/insights`), **Teams** (`/teams`) — HR-only.
- **Meetings** (`/meetings`) — manager/HR-only meeting-load analysis.
- **One-on-Ones** (`/one-on-ones`), **Pulse** (`/pulse`), **Inbox**
  (`/inbox`) — 1:1 agendas, weekly anonymous survey, notification center.
- **Transparency** (`/transparency`) — plain-language "what this app knows
  about you."
- **Settings** (`/settings/appearance`, `/settings/schedule`) — theme
  (system/light/dark), accessibility, and quiet-hours configuration.

## Getting started

This runs against a **hosted** Supabase project — there is no local Supabase
instance in this workflow.

```bash
npm install
cp .env.local.example .env.local   # fill in from your Supabase project's API settings
npm run seed                       # creates 24 demo employee/manager auth users
                                    #   (requires employees already seeded in the DB)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo password for every
seeded account: `petal-demo-2026` — **exploration only, never for a real
deployment** (no password reset, no email confirmation, one shared password).

Optional: set `SLACK_BOT_TOKEN` / `SLACK_CHANNEL_ID` in `.env.local` to make
Right to Disconnect actually post to Slack. See `.env.local.example` for the
setup steps. Left blank, the feature still works, it just doesn't post
anywhere real.

## Structure

- `app/(app)/*/page.tsx` — one route per pillar; Server Components fetch via
  `lib/supabase/queries.ts` and related domain modules.
- `app/(app)/*/{*Client.tsx,actions.ts}` — client interactivity and Server
  Actions, colocated per route.
- `app/(app)/layout.tsx` — app shell: nav rail/panel, Nudges provider, toast
  dock.
- `app/globals.css` — design tokens (three-state theme, high-contrast and
  muted-palette variants) exposed to Tailwind via `@theme inline`.
- `components/ui/` — all UI primitives (Card, Chip, Button, Modal, Avatar,
  CommandPalette, etc.), no external library.
- `components/{burnout,mood,shell,tasks,...}/` — pillar-specific pieces.
- `lib/` — domain logic (`burnout.ts`, `burnout-signals.ts`, `boundary-v2.ts`,
  `authz.ts`, `schedule.ts`, `tasks.ts`, `contrast.ts`, …) and
  `lib/supabase/*.ts` — the data-access layer, split by domain.
- `proxy.ts` — auth guard + session refresh (Next.js 16's renamed
  middleware).
- `supabase/migrations/` — 36 numbered migrations, applied by hand in the
  hosted project's SQL Editor; never edited once applied (see
  [AGENTS.md](AGENTS.md)).
- `scripts/` — seeding (`seed.ts`, `seed-org.ts`, `seed-tasks.ts`,
  `seed-calendar.ts`, `seed-role-accounts.ts`) and verification
  (`verify-schema.ts`, `verify-rls.ts`, `verify-employee-settings.ts`)
  utilities using the service-role key.

## Verification

```bash
npx tsc --noEmit   # type check
npm run lint       # ESLint 9, flat config
npm test           # Vitest — 29 files under lib/__tests__/
npm run build      # production build
```

All four are expected to pass clean before any change is considered done.
Tests cover burnout scoring, boundary decisions, task logic, attendance,
authorization (`canSee`/`isManagerOf`), scheduling, and an automated WCAG 2.1
AA contrast check that reads the live stylesheet.

## Further reading

- [PRD.md](PRD.md) — full product requirements, current state.
- [AGENTS.md](AGENTS.md) — architecture, conventions, database/security
  rules, and the actual development workflow (this is the source of truth
  for any AI coding tool working in this repo, including Claude Code).
- [CLAUDE.md](CLAUDE.md) — Claude Code-specific notes on top of AGENTS.md.
