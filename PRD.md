# Product Requirements Document

## Petal — Workplace Wellbeing Ecosystem

**Status:** v2.0 — Reflects the live, built application (supersedes the Stage 2
hackathon PRD, "AxionHR — Workplace Wellbeing Ecosystem," v1.0, Aug 5 2026)
**Originally submitted as:** AxionHR Wellness & Mood Quality Hackathon, Stage 2
— Blueprint Design, by Team HTTP hack
**This revision date:** reflects the codebase as of migration `0036`, 19 routes,
Next.js 16.3.1

> The original Stage 2 PRD described six pillars, all "Designed, not yet
> built," running entirely on synthetic data with no real integrations. That
> document is preserved for history at `Hackathon Stage 2 PRD.pdf`. Everything
> below describes what actually shipped: real Supabase-backed auth and data,
> real Row-Level Security as the privacy boundary, a real Slack integration,
> and eleven additional screens the original scope never mentioned.

---

## 1. Overview and Objective

Petal is a live, Supabase-backed HR wellbeing platform for a ~24-person
organization. All six original pillars are built and shipped, and the product
has grown well past that original scope: a full task/project management
system, org-wide analytics for HR, attendance and PTO tracking, 1:1s, a weekly
anonymous pulse survey, a notification inbox, and a transparency page that
tells every employee in plain language what the app knows about them.

Every pillar shares one `employees`-keyed data core, one Supabase project, one
design system, and one Next.js codebase — the "ecosystem" bet from the
original PRD held. The proof point named in the original document (Focus Mode
reading Burnout's risk band as an input) is live in production, and a second
cross-pillar link now exists: Burnout's v2 score reads real task-load and
attendance signals, not just synthetic activity data.

**Objective, unchanged from v1.0:** catch burnout and disengagement before
they turn into resignations, by unifying wellbeing signals into one system
where a signal in one pillar can inform another, giving managers and HR a
real-time picture of team wellbeing instead of a quarterly survey snapshot.

## 2. Background and Context

The original hackathon brief posed six discrete challenge categories
(Predictive Analytics, Physical Health, Mental Well-being, Work-Life
Boundaries, Social Health, Cognitive Inclusivity). The team built past Stage 2
into a real product: Supabase Auth replaced the synthetic employee list,
Postgres RLS replaced "the UI hides it," and a Server Component / Server
Action architecture replaced client-only simulation for every pillar except
Nudges, which is still deliberately client-side and session-local (see §7.2).

The product was renamed from AxionHR to **Petal** during the build. Both names
refer to the same codebase; "AxionHR" appears only in historical documents.

## 3. Problem Statement

Unchanged from v1.0 — this is still the problem the product targets:

- Annual/quarterly engagement surveys are lagging indicators; sentiment is
  captured months after it mattered, and participation suffers from survey
  fatigue.
- Burnout goes unnoticed until an employee resigns or takes extended leave;
  there is no early, non-invasive signal.
- Remote/hybrid work has eroded the boundary between office hours and
  personal time, producing toxic "always-on" cultures.
- Point solutions (a survey tool, a wellness app, a calendar plugin) don't
  talk to each other, so no one gets a holistic picture of team health.

A fifth failure mode showed up once the product was real rather than
simulated, and shaped what got built beyond the original six pillars:
**wellbeing signals were invisible to the people who create the workload that
drives them** — there was no shared task system, no manager-facing workload
view, and no way for HR to see org-wide trends without reading every
individual screen. Tasks, Insights, and the workload rebalancer exist to close
that gap.

## 4. Users and Personas

Unchanged in shape from v1.0, now backed by real Supabase Auth accounts and
enforced by Postgres RLS rather than described intent:

| Persona | Description | Primary Interactions |
|---|---|---|
| **Employee** (`app_role = employee`) | The primary daily user. | Everything in §7.1–§7.10 scoped to self: nudges, mood check-in, boundary messages, buddy pairing, Focus Mode, own tasks, own attendance/PTO, own 1:1s, weekly pulse, own inbox. |
| **Manager** (`app_role = manager`) | Oversees their own reports' wellbeing at a scoped level. | Everything an Employee sees, plus: team-scoped Burnout table and Directory bands (via `canSee`/`isManagerOf`, never org-wide), team Attendance roster, Meetings (meeting-load analysis), 1:1 management view, PTO approvals for their reports. |
| **HR Administrator** (`app_role = hr`) | Handles workforce-wide wellbeing follow-up. | Org-wide Burnout/Directory/Attendance, **Insights** (org trend, correlations, notification hold rate — HR-only route), **Teams** (assign managers — HR-only route), the unlinked concern-flag queue from Kudos, buddy-pairing rotation trigger. |

Three real accounts back this today: 24 seeded employee/manager personas
(`scripts/seed.ts`) plus a dedicated "Petal HR" demo account
(`petal.hr@petal.test`, migration `0031`) distinct from the earlier pattern of
repurposing an employee persona as the HR login.

## 5. Goals and Success Metrics

| Goal (v1.0) | v1.0 Success Metric | Current Status |
|---|---|---|
| Ship a centralized wellbeing platform, not six disconnected tools. | All pillars share one `employee_id`-keyed core and one Supabase project. | **Met.** 19 routes, one Postgres schema, 36 migrations, one codebase. |
| Every scoring/decision engine is explainable, not a black box. | Burnout, Boundary, Focus logic stay fully rule-based, one sentence each. | **Met.** No ML anywhere. Burnout v2 adds three weighted factors on top of the original formula (§7.1) but remains arithmetic, not learned. |
| Every score or decision is proven, not eyeballed. | Automated tests pass before merge. | **Met, and expanded.** 29 Vitest files under `lib/__tests__/`, covering burnout, boundary, contrast/accessibility, tasks, attendance, authz, scheduling, and more. `tsc --noEmit`, ESLint, and `next build` are required to pass alongside tests. |
| Privacy-by-design holds under test, not just in the UI. | No individual mood/check-in/focus state exposed outside its owner (or HR, for flags) at the query level. | **Met, and the boundary moved.** RLS (Postgres policies, `0002`/`0010`) is now the actual enforcement layer; `lib/authz.ts` mirrors it in the UI only, and says so explicitly in its own docstring so the two are never confused. |
| The "ecosystem" story is demonstrable. | Centralized Employee Profile ships once 2–3 pillars are built. | **Not met as originally specified.** No `/employees/[id]` unified profile route exists. The cross-pillar story is instead demonstrated by Focus Mode reading Burnout's band, and Burnout v2 reading Attendance/Tasks signals — narrower than a unified profile page, but real and live. |
| Stage 2 deliverable complete on time. | PRD + hi-fi prototypes, Aug 10 2026. | Superseded — this document. |

New goal, not in v1.0, reflecting what the build actually had to solve:

| Goal | Success Metric |
|---|---|
| A role-scoped view of the org never leaks more than the viewer is entitled to, even under a client-side bug. | Enforced by Postgres RLS, independent of the Next.js app. `lib/authz.ts`'s own docstring: "if this and the SQL ever disagree, the failure mode is a UI glitch, never a data leak." |

## 6. Scope — What's Actually Built

Every pillar below is **live**, not "Designed." Status labels from the
original PRD are removed; this section instead separates the original core
from what grew around it.

### 6.1 The original six pillars — all live

1. Burnout Risk Analytics — §7.1
2. Quick Nudge Tool — §7.2
3. Track the Mood — §7.3
4. Boundary ("Right to Disconnect") — §7.4
5. Give Me a Coffee (buddy check-ins / Kudos) — §7.5
6. Adapt to the Workspace (Focus Mode) — §7.6

### 6.2 Built beyond the original scope

7. Tasks / Projects — full project management (§7.7)
8. Attendance & Time Off — real clock-in/out and PTO workflow (§7.8)
9. Insights — HR-only org analytics and correlations (§7.9)
10. Teams — HR-only manager assignment (§7.10)
11. One-on-Ones — manager/report 1:1 agenda tool (§7.11)
12. Meetings — manager/HR meeting-load analysis (§7.12)
13. Pulse — weekly anonymous one-question survey (§7.13)
14. Inbox — unified, schedule-aware notification center (§7.14)
15. Transparency — plain-language "what this app knows about you" page (§7.15)
16. Directory — org browser with privacy-gated burnout bands (§7.16)
17. Settings (Appearance / Schedule) — theme, accessibility, and quiet-hours
    configuration (§7.17)

### 6.3 Still out of scope, deliberately

- **Password reset / email confirmation.** One shared demo password
  (`petal-demo-2026`), explicitly documented as never to front a real public
  deployment.
- **Unified `/employees/[id]` profile.** Never built; see §5.
- **Recurring tasks.** Explicitly deferred in the Tasks migration's own
  comments — "no phase in the current roadmap."
- **Real calendar sync.** `calendar_events` is an internal table populated for
  the app's own use (meeting-load signal, Focus Mode triggers); it is not
  synced to Google/Outlook.
- **Real per-employee Slack DMs.** Slack delivery (§10) posts to one shared
  channel via a bot token — there's no per-employee Slack user ID in the
  schema to support real DMs.

## 7. Functional Requirements

### 7.1 Burnout Risk Analytics

Unnoticed burnout is still the core problem this pillar addresses, but the
engine is now two deliberately-separate layers (`lib/burnout-signals.ts:1-18`
documents why they were never merged):

- **Base composite (unchanged from v1.0, frozen — `lib/burnout.ts` may not be
  edited by an AI agent working on this repo):**
  `composite = 0.30·streak + 0.25·meeting + 0.25·offHours + 0.20·pto`, with
  `streakScore = min(100, streakDays×8)`,
  `meetingScore = min(100, avgMeetingHours/availableHours×100)`,
  `offHoursScore = min(100, weeklyOffHoursMessages/15×100)`,
  `ptoScore = min(100, daysSincePto/1.2) + 30 if messaged while on PTO`.
  Same four bands, same thresholds: Low 0–24, Medium 25–49, High 50–74,
  Critical 75–100.
- **Burnout v2 (additive, drives every screen today):** feeds the same frozen
  formula real attendance data (real clock-ins/PTO, not synthetic
  `daily_activity`) instead of fixture booleans, then layers three new
  factors: `taskLoad` (committed task hours vs. weekly capacity),
  `overdue` (overdue task count × 20, capped 100), and `recovery`
  (no-break days × 15 + weekend-work days × 20 + a flat penalty for a >9.5h
  average day). `compositeV2 = 0.70·base + 0.12·taskLoad + 0.10·overdue +
  0.08·recovery`, banded through the same thresholds as the base score.
- FR-1.3 (API endpoints) is superseded by Server Actions and Server
  Components — there is no public REST API; `/burnout` reads through
  `lib/supabase/queries.ts` and `lib/burnout-signals.ts` server-side.
- FR-1.4 (archetype validation) — the four named archetypes (Healthy Hannah,
  Warning Will, Risky Rita, Burnout Bob) remain seeded accounts and are
  exercised by `lib/__tests__/burnout.test.ts` and
  `burnout-signals.test.ts`.
- **New:** a 7-day forecast (`lib/supabase/forecast.ts`) projects each
  visible employee's v2 score forward using the same rules, surfaced on
  Burnout and Dashboard.
- **New:** an "interventions" workflow (`interventions` table, migration
  `0019`) turns a flagged burnout signal into an actionable, trackable item
  rather than a static score.
- Screens: Team Overview (role-scoped via `isHr`/`isManagerOf`), Employee
  Detail (sub-score bars, 14-day trend, forecast), all using the
  WCAG-AA-tested band color system (§11).

### 7.2 Quick Nudge Tool

Still deliberately client-side and session-local (`lib/nudge-context.tsx`,
documented in `AGENTS.md` as "fully client-side, session-local via React
Context") — the one pillar that never moved to real persistence, because a
nudge session is inherently ephemeral. FR-2.1 through FR-2.4 (50-minute
trigger, type rotation, quiet-hours/daily-cap suppression, snooze) are
implemented as specified in v1.0, unchanged.

### 7.3 Track the Mood

Implemented as specified (one-tap, five-value, upsert-based one-per-day),
with query-level anonymity enforced by `get_team_mood_aggregate()` — a
security-definer RPC that returns `null` below 3 check-ins, not just a
UI-level hide. New beyond v1.0: optional free-text mood tags (migration
`0029`) and an org-wide weighted mood trend RPC used on the Dashboard.

### 7.4 Boundary ("Right to Disconnect")

The single biggest scope change from v1.0: **this is no longer simulated.**
`lib/slack.ts#sendSlackMessage` posts for real to a Slack workspace via a bot
token (`SLACK_BOT_TOKEN`/`SLACK_CHANNEL_ID`, optional — the feature degrades
gracefully without them) when a message evaluates to "deliver now" and Slack
is the chosen channel. FR-4.2's decision matrix (delivered / delayed / warned
/ blocked-until-return) is implemented as specified, plus a **cancel** action
for still-held messages (migrations `0034`/`0035`) that wasn't in v1.0's
scope at all. HR sees an off-hours-send-rate breakdown by team
(`get_boundary_offhours_rate()`).

### 7.5 Give Me a Coffee (buddy check-ins / Kudos)

Changed from v1.0's spec: pairing is a **random weekly shuffle**
(`rotate_buddies()`, HR-triggered, security-definer), not a round-robin
circle method tracked to full-cycle completion. `coffee_chats` (propose /
accept / decline / complete) sits alongside the check-in tag/note flow.
FR-5.5's "quiet HR flag" is real and separated from the check-in itself —
`concern_flags` (migration `0016`) replaced an earlier `kudos.flagged`
column that conflated the two.

### 7.6 Adapt to the Workspace (Focus Mode)

Implemented as specified, including the cross-pillar read named in v1.0 as
the architecture's proof point: Focus Mode reads the employee's current
Burnout v2 band as a baseline-sensitivity input (FR-6.3), live in
`app/(app)/focus/`. Manual override (FR-6.5) and full privacy of focus state
(FR-6.6) hold. An active Focus session now also suppresses immediate
notification delivery app-wide (§7.14) — a link the original spec didn't
anticipate, discovered once a real notification system existed to interact
with.

### 7.7 Tasks / Projects — not in the original scope

A full project-management layer: projects → board sections → tasks →
subtasks → comments, drag-and-drop board/list views (`@dnd-kit`), a saved-view
system (List/Board/Calendar/Timeline, driven by URL state), a per-task audit
log (`task_events`), soft-delete (a hard `DELETE` was replaced after an
audit finding), and a workload view that both HR and the burnout engine read
from. A workload rebalancer can move tasks between over- and under-loaded
people and notifies both sides.

### 7.8 Attendance & Time Off — not in the original scope

Real clock-in/out and break tracking (`work_sessions`, `session_breaks`),
replacing v1.0's synthetic `daily_activity.worked_today` flag as the source
of truth for Burnout v2's real signals. PTO requests (vacation / sick /
personal / mental health) with an approval workflow, scoped to what a
manager can see via `visibleTo()`.

### 7.9 Insights — not in the original scope, HR-only

Org-wide trend lines, correlation RPCs (meeting-load × burnout, off-hours ×
mood), and a notification-hold-rate view. Hard-gated: `notFound()` for any
non-HR viewer.

### 7.10 Teams — not in the original scope, HR-only

Assigns managers to teams (`isManagerOf` reads this). Hard-gated the same
way as Insights.

### 7.11 One-on-Ones — not in the original scope

A scheduling/agenda surface for manager–report 1:1s. Employees see their own;
managers and HR get a management view.

### 7.12 Meetings — not in the original scope, manager/HR-only

Meeting-load analysis feeding into Burnout v2's `meeting` sub-score and
Focus Mode's back-to-back-meeting trigger.

### 7.13 Pulse — not in the original scope

A weekly, single-question, anonymous survey, aggregated with the same n≥3
anti-de-anonymization floor Track the Mood established.

### 7.14 Inbox / Notifications — not in the original scope

Every notification kind in the app (task assignment, mention, PTO decision,
due-soon reminder, held boundary message, task reassignment, intervention
suggestion, 1:1 scheduled, coffee chat proposed) funnels through one
`enqueue()` path. Delivery timing respects the *recipient's* own working
hours and quiet hours, batching mode, and per-kind mute preferences; an open
Focus session holds anything that would otherwise arrive immediately. No
background worker — delivery is computed at read time; a realtime
subscription drives the unread badge. A global command palette (⌘K/Ctrl+K)
searches pages/people/projects/tasks and doubles as the app's keyboard-
shortcut layer (`f` for Focus Mode, snooze/resolve on an active nudge).

### 7.15 Transparency — not in the original scope

A plain-language page explaining what data the app holds on the signed-in
employee and how each pillar's privacy guarantee actually works, citing the
real migrations/modules that enforce it. Exists specifically so the privacy
claims in this document aren't just marketing copy — an employee can read
the same thing here.

### 7.16 Directory — expanded from v1.0's implicit "employee list"

An org browser grouped by burnout-risk band, with the band itself
privacy-gated per viewer via `canSee()` — a viewer who isn't the person, their
manager, or HR sees the person listed but not their band, matching the
privacy stance Mood and Burnout already took elsewhere in the app.

### 7.17 Settings (Appearance / Schedule) — not in the original scope

Appearance: three-state theme (system/light/dark), high-contrast mode,
muted-palette mode, reduced-motion, font scale, density — all persisted
per-employee. Schedule: working hours, quiet hours, notification batching
mode, muted notification kinds — the same schedule every other pillar's
timing logic reads from.

## 8. Non-Functional Requirements

- **Privacy-by-design, enforced twice.** RLS (Postgres policies) is the real
  boundary; `lib/authz.ts` is a UI-only mirror that says explicitly, in its
  own docstring, that disagreement between the two fails safe (a UI glitch,
  never a leak) rather than the reverse.
- **Transparency over black-box scoring — held.** Every scoring/decision
  system remains rule-based arithmetic. Burnout v2 added factors, not a
  model.
- **Validated, not eyeballed — held and expanded.** 29 Vitest files (up from
  the original archetype/edge-case plan) cover burnout, boundary, attendance,
  authz, scheduling, mood, tasks, notifications, and — new — automated
  WCAG 2.1 AA contrast testing (`lib/contrast.ts` +
  `lib/__tests__/contrast.test.ts`) that parses the live stylesheet, so a
  color-token edit that breaks contrast fails CI-equivalent checks rather
  than shipping.
- **No real third-party integrations — revised.** No longer fully true.
  Slack delivery is real (§7.4/§10). Everything else remains synthetic or
  internal-only (no calendar sync, no email).
- **Accessibility, not in v1.0's NFRs at all.** Three-state theme, a
  high-contrast mode, a muted-palette mode, and an automated AA contrast
  regression test now exist as first-class requirements, added after a real
  audit found several band-color combinations failing contrast in the
  original single-theme palette.

## 9. Data Requirements

The two-table shared core from v1.0 (`employees`, `daily_activity`) still
exists, but `daily_activity` is now a legacy/synthetic-fallback source —
Attendance's `work_sessions`/`pto_requests` are the real signal for anything
built after migration `0012`. The schema has grown from 7 planned migrations
to **36 applied migrations**. Full table inventory:

| Domain | Tables | Introduced |
|---|---|---|
| Core / legacy | `employees` (+ `app_role`, `auth_user_id`), `daily_activity`, `risk_scores` (legacy snapshot) | 0001–0002, 0009 |
| Nudges | `nudge_events`, `nudge_preferences` | 0001 |
| Mood | `mood_checkins` (+ free-text tags) | 0001, 0029 |
| Kudos / Boundary | `kudos`, `boundary_events` | 0001, 0004–0005, 0034–0035 |
| Tasks | `projects`, `board_sections`, `tasks`, `subtasks`, `task_comments`, `labels`, `task_labels`, `task_events`, `task_views` | 0006, 0011, 0013, 0033 (soft-delete) |
| Org / roles | `teams`, `employees.app_role` | 0009 |
| Attendance | `work_sessions`, `session_breaks`, `pto_requests` | 0012 |
| Notifications | `work_schedules`, `notification_prefs`, `notifications`, `mentions` | 0014, 0027 (realtime) |
| Focus / prefs | `focus_sessions`, `ui_preferences` | 0016 |
| Buddy / concern | `buddy_pairings`, `coffee_chats`, `concern_flags` | 0016 |
| Interventions | `interventions` | 0019 |
| One-on-ones | `one_on_ones` | 0021 |
| Calendar / meetings | `calendar_events` | 0022 |
| Pulse | `pulse_questions`, `pulse_responses` | 0023 |

Key security-definer RPCs enforcing the RLS-as-real-boundary model:
`current_employee_id()`, `current_app_role()`, `is_hr()`, `manages()`,
`can_see_employee()` (0010 — the RLS core); `get_team_mood_aggregate()`
(0003, n≥3 floor); `get_notification_schedule()` (0015); `rotate_buddies()`
(0016); `get_recipient_availability()`, `get_org_mood_trend()`,
`get_boundary_offhours_rate()` (0016); `get_notification_hold_rate()` (0020);
`get_pulse_results()`/`get_pulse_trend()`/`has_answered_pulse()` (0023);
`get_busy_intervals()` (0025); `get_meeting_burnout_corr()`/
`get_offhours_mood_corr()` (0028); `employees_provision_settings()` (0036).

**Migration discipline, unchanged and load-bearing:** an applied migration is
never edited. A bug found after the fact gets a new, higher-numbered
migration instead — this has happened repeatedly and is treated as the
normal way schema issues get corrected here (e.g. `0015` fixed `0014`;
`0032`/`0036` fixed `0014`'s/`0031`'s backfill gaps; `0034`/`0035` fixed
`boundary_events` gaps found during verification).

## 10. Integrations and Dependencies

- **Slack — real, not simulated.** `lib/slack.ts` posts to
  `chat.postMessage` via a bot token to one fixed channel, triggered when a
  Boundary message resolves to "deliver now." Optional: missing
  configuration degrades to "feature works, nothing posts anywhere real,"
  never an error surfaced to the sender.
- **No calendar or email integration.** `calendar_events` is populated and
  read entirely within the app; nothing syncs to Google/Outlook/etc.
- **No cron/background worker.** Notification delivery timing and
  Focus-session-driven holds are computed at read time, not on a schedule.
- **Hosted Supabase only, no local instance.** `supabase/config.toml` is an
  inert leftover from an early `supabase init` that was never followed by
  `supabase start`. There is no Supabase CLI in the actual workflow — every
  migration is written as a file, then run by hand in the hosted project's
  SQL Editor, then verified with a narrowly-scoped Node script using the
  service-role key (`npm run verify:schema`, `verify:rls`,
  `verify:settings`).
- **Team process, revised from v1.0.** The original "each pillar on its own
  feature branch, merge only after tests pass" model held throughout the
  build; `main` is not GitHub-branch-protected today but is treated as
  protected by convention.
- **Library dependencies, revised.** Next.js **16.3.1** (App Router,
  Turbopack), React **19.2.8**, TypeScript **5** (strict), Tailwind CSS
  **v4**, `@supabase/supabase-js` **2.112.3** + `@supabase/ssr` **0.12.4**,
  Zod **4.4.3**, `@dnd-kit` **6.3.1** (now actually wired into Tasks —
  v1.0-era docs once called it unused), Vitest **4.1.10**. Not Next.js 14 as
  v1.0 specified — the framework major-version jump changed real APIs (the
  auth middleware file is `proxy.ts`, not `middleware.ts`, in this version).
  `recharts`/`lucide-react` from v1.0's stack were **not** adopted — charts
  are hand-built (`components/burnout/Sparkline.tsx` etc.) and icons are a
  hand-built inline SVG sprite, no icon library.

## 11. UX/Design and Brand

Design tokens are no longer the fixed five-color table from v1.0 — that
palette is exactly what an accessibility audit found broken (the same hex
meant a different burnout severity on different screens, and several
fill-as-text combinations failed WCAG AA). The current system:

- Band colors are defined once, as CSS custom properties in
  `app/globals.css`, varying automatically by theme, high-contrast mode, and
  muted-palette mode — `lib/burnout-bands.ts` exposes `BAND_FILL`
  (solid segment), `BAND_ON_FILL` (text on that fill), and `BAND_TEXT`
  (text/stroke on a normal background), never a literal hex in a consuming
  component.
- Every band ink/tint pairing is asserted ≥4.5:1 (WCAG AA normal text) by an
  automated test that reads the actual stylesheet, in every theme
  combination — light, dark, high-contrast × both.
- Three-state theme (system/light/dark) — "System" is the default,
  because a fixed light/dark toggle used to be a one-way door for anyone who
  wanted to follow their OS.
- Typeface (Inter) and the "supportive, not punitive" interaction tone from
  v1.0 both held: nudges are still non-blocking snoozable toasts, Boundary
  still warns rather than hard-blocking, buddy check-ins still carry no
  leaderboard, and Focus/Calm states still ease rather than snap.
- Focus Mode's three-density requirement (Standard / Focus-Simplified /
  Calm-Recovery) from v1.0 held and shipped as specified.

## 12. Assumptions, Constraints and Risks — current

**Constraints, revised from v1.0:**

- No real calendar/email API integration remains true. Slack is the one
  exception, and it is real.
- Every schema change still lives in its own numbered migration file, and an
  applied migration is never edited — the constraint held for 36 migrations
  in a row, including several self-correcting ones.
- `main` is convention-protected, not GitHub-protected, today.

**Risks, updated:**

- **Documentation drift.** `AGENTS.md`'s own descriptive prose (migration
  count, route list) was found stale during this revision — its *rules*
  (workflow, frozen files, security requirements) remain accurate, but
  snapshot facts inside a hand-maintained doc drift as the app grows. This
  PRD is exposed to the same risk and should be re-checked against the repo
  periodically, not treated as permanently current.
- **Single shared Slack channel.** Because no per-employee Slack ID exists,
  every real Slack delivery lands in one channel rather than a DM — fine for
  a demo/single-org deployment, not a real multi-recipient boundary-message
  system.
- **Demo auth remains demo auth.** One shared password, no password reset,
  no email confirmation — explicitly not safe to front a real deployment,
  and this has not changed.
- **RLS/UI mirror drift risk, named explicitly in the code itself.**
  `lib/authz.ts` and the Postgres policies it mirrors must be kept in sync by
  hand; the failure mode if they diverge is documented as fail-safe (UI
  glitch, not a leak), but the risk of divergence itself is real and grows
  with every new role-scoped screen.

## 13. Timeline and Milestones — status

| Phase (v1.0) | Deliverable | Status |
|---|---|---|
| Phase 1 — Blueprint Design | PRD + hi-fi prototypes | Done, Aug 10 2026 (superseded by this document) |
| Phase 2 — Build | Shared core + Burnout + Nudges | **Done**, and both pillars grew past spec (Burnout v2, forecast, interventions) |
| Phase 3 — Build | Mood + Boundary | **Done**, Boundary gained real Slack delivery and a cancel flow |
| Phase 4 — Build | Kudos + Focus Mode | **Done**, Kudos' pairing model changed (weekly random shuffle, not quarterly round-robin) |
| Phase 5 — Unified Employee Profile | `/employees/[id]` | **Not done.** Superseded by narrower, real cross-pillar reads (Focus ← Burnout, Burnout v2 ← Attendance/Tasks) instead of one combined profile page. |

Beyond the original five phases, eleven additional screens (§6.2) shipped
without ever appearing in a v1.0 milestone, driven by needs discovered once
the product had real users and real data instead of a synthetic dataset.

## 14. Open Questions — current

- Is a unified `/employees/[id]` profile still wanted, now that its two
  original justifications (Focus reading Burnout, a "prove the shared core
  works" demo) are already satisfied by narrower cross-pillar reads?
- Should `main` branch protection be turned on at the GitHub level now that
  the convention has held informally across dozens of migrations and PRs?
- Is real Slack DM delivery (vs. the current single shared channel) worth the
  schema change (a per-employee Slack user ID) given the app's current
  single-org scope?
- What is the actual hosting/deployment target today — this remained open in
  v1.0 and nothing in the repository resolves it.

---

*This document was generated by reading the live codebase (36 applied
migrations, `app/(app)/` route tree, `lib/`, `AGENTS.md`/`CLAUDE.md`) rather
than by updating the original PRD's prose in place, so that every claim above
can be traced to a real file or migration rather than carried forward
unverified.*
