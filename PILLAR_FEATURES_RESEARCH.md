# Wellbeing Pillar Enhancement Features from Productivity Systems

Based on analysis of Petal's 7 pillars and existing codebase, here are features from Asana, Linear, Notion, ClickUp, Monday.com, and Jira that could enhance wellbeing outcomes.

---

## PILLAR 1: BURNOUT RISK (Analytics)
**Current state:** Composite V2 score using meeting load, attendance streak, off-hours activity, days since PTO, task committed hours, overdue tasks, no-break days, weekend work.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Asana | Goals/OKRs with progress tracking | Links strategic work to burnout risk - people stretched on misaligned work burn out faster. Visible goal progress reduces ambiguity stress. | Low | goals table + RPC exists in schema (0009), just needs UI. Reuses getEmployees, getWorkload. |
| Asana | Workload capacity alerts (auto) | Proactive notification when committed hours exceed capacity threshold - prevents surprise overload. | Low | weeklyCapacityHours on employees, committedHours from tasks already computed. Just needs scheduled check + nudge integration. |
| Linear | Cycle/sprint velocity tracking | Sustainable pace visibility - teams see if they're consistently overcommitting per cycle. | Low | completed_at on tasks (0011) + estimate_hours = velocity data. Needs aggregation RPC + chart component. |
| ClickUp | Time tracking (native) | Actual vs estimated hours reveals estimation bias - chronic underestimation = burnout driver. | Medium | New time_entries table needed, but schema pattern exists (task_events). UI reuses TaskRow patterns. |
| Monday.com | Pulse/activity feed per person | Detects 'always on' patterns - late-night edits, weekend activity, no gaps between tasks. | Low | task_events.is_off_hours + boundary_events + attendance clock-in already capture this. Just needs aggregation view. |
| Jira | Burnout risk factors as custom fields | Makes risk drivers explicit and filterable - 'show me everyone with >50hrs committed AND no PTO in 60 days' | Low | All factors already computed in computeBurnoutV2. Just needs filter UI on BurnoutClient. |
| Asana | Portfolio view (multi-project workload) | Cross-project visibility prevents siloed overload - a person looks fine in Project A but drowning across A+B+C. | Low | getWorkloadRich already aggregates across projects. Needs portfolio grouping UI. |
| Linear | Insights: cycle time & scope creep | Scope creep = hidden workload. Tracking added scope per cycle protects recovery time. | Low | task_events log has created, moved, priority_changed. Scope creep = tasks added mid-cycle. |

---
## PILLAR 2: NUDGES (Wellbeing)
**Current state:** 4 nudge types (stretch, hydrate, eye_rest, posture), session-based simulation, quiet hours aware, daily cap (6), snooze (10min), browser notifications.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| ClickUp | Custom reminder types per user | Personalization - some need posture, others need hydration. One-size-fits-all reduces adherence. | Low | NUDGE_TYPES array + NUDGE_META in constants. Just needs user preference column + filter in provider. |
| Notion | Reminder templates/recipes | 'After 2hrs deep work -> stretch + hydrate' - compound nudges build habit stacks. | Low | NudgeProvider already has sessionMinutes, meetingSoon. Add rule engine (simple JSON config). |
| Monday.com | Automation: 'When status changes to Done -> nudge break' | Links nudges to actual work completion, not just time - more meaningful timing. | Low | task_events has completed kind. Add trigger in recordEvent -> nudge queue. |
| Asana | 'Focus time' calendar blocks + nudge suppression | Protects deep work - nudges don't interrupt scheduled focus blocks. | Low | FOCUS_TIMELINE in constants + meetingSoon flag. Just needs calendar integration (Google/Outlook) or manual blocks. |
| ClickUp | Nudge analytics dashboard | Shows which nudges work (done vs snoozed vs suppressed) - iterate on wellbeing interventions. | Low | log in useNudges already tracks result. Just needs aggregation + chart (reuse Sparkline). |
| Linear | Keyboard-first nudge dismissal | Reduces friction - power users dismiss without mouse, stay in flow. | Low | NudgeToastCard already has onDone/onSnooze. Add keyboard handler (Esc, Enter, S). |
| Notion | Page-level 'take a break' reminders | Context-aware - nudges relevant to current activity (writing vs coding vs meeting). | Medium | Needs activity detection (active tab/page). Could start with manual 'mode' selector in Focus Mode. |

---

## PILLAR 3: TRACK THE MOOD (Wellbeing)
**Current state:** 5-point daily check-in, team aggregates (min 3 for anonymity), org-weighted average, 7-day comparison, axolotl avatar.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Notion | Mood tags/context (optional) | 'Stressed - deadline' vs 'Stressed - personal' - same score, different support needed. | Low | mood_checkins table exists. Add optional tags text[] column. UI: chip selector (reuse Chip component). |
| ClickUp | Mood trends per project/team | Identifies toxic projects - 'Project X correlates with 0.8 mood drop'. | Low | mood_checkins + employees.team + tasks.project_id (via assignee). Needs RPC join. |
| Monday.com | Pulse: anonymous team sentiment feed | '3 people felt low this week' - normalizes discussion without identifying anyone. | Low | get_team_mood_aggregate RPC exists. Just needs 'share anonymous summary' toggle + feed UI. |
| Asana | Status update + mood coupling | Weekly reflection: 'How did this week feel?' - builds self-awareness + manager visibility (opt-in). | Low | mood_checkins daily -> add weekly rollup RPC. Reuses PageHead + Card patterns. |
| Linear | Mood velocity (rate of change) | Rapid decline = early warning. 'Mood dropped 2 points in 3 days' triggers check-in. | Low | Daily data exists. Add mood_delta computation in get_team_mood_aggregate or client-side. |
| Jira | Happiness metric in sprint retro | Integrates wellbeing into existing ritual - not a separate tool. | Low | Sprint concept doesn't exist yet, but 'last 14 days' rollup exists (burnout history). Add mood to retro template. |
| ClickUp | Custom mood scales per team | Engineering uses 1-5, Design uses emoji, Support uses energy/drain - cultural fit. | Medium | MOODS constant is shared. Needs team-level override in teams table (0009 has teams). |

---
## PILLAR 4: RIGHT TO DISCONNECT (Wellbeing)
**Current state:** Compose message -> preview delivery time in recipient's work hours -> delayed send via boundary_events log (blocked/warned/delivered/delayed).

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Slack/Teams | Scheduled send (native) | 'Send at 9am their time' - eliminates need for separate boundary tool. | Medium | boundary_events + scheduled_delivery column exists. Needs background worker (P6 decision: no cron yet). Alternative: client-side setTimeout + service worker. |
| Asana | Do Not Disturb schedules per person | Automatically suppresses notifications outside work hours - system-level, not just message-level. | Low | employees.timezone + WORK_START_MIN/END_MIN in constants. Add dnd_start, dnd_end columns. Proxy middleware checks. |
| ClickUp | Urgent/important matrix for messages | 'Is this truly urgent?' - forces sender reflection, reduces false urgency. | Low | BoundaryClient has compose UI. Add radio: 'Urgent (deliver now)' vs 'Normal (schedule)'. Log choice in boundary_events. |
| Notion | Threaded replies in delayed messages | Recipient replies next morning -> sender sees thread, not new notification. Preserves context. | Medium | boundary_events is 1-row-per-send. Needs parent_event_id self-ref + thread UI. |
| Monday.com | Auto-reply during off-hours | 'I'm offline until 9am. For emergencies, contact X' - sets expectations, reduces anxiety. | Low | employees table -> add away_message, away_until. Proxy middleware injects auto-reply on inbound (if email/slack integration). |
| Linear | Notification batching (digest) | Single 9am digest instead of 12 pings - reduces context switching, protects focus. | Medium | Needs notification infrastructure (P6). Low-effort start: daily email digest via Supabase Edge Function + cron. |
| Jira | Escalation policy for true emergencies | 'Page me only if X' - clear boundary, rare exceptions. Reduces 'cry wolf' fatigue. | Low | Add emergency_contact_id on employee. Boundary action: if urgent=true + recipient.dnd_active -> notify emergency contact. |

---

## PILLAR 5: GIVE ME A COFFEE / KUDOS (Culture)
**Current state:** Rotating buddy pairing, 4 tag options, progress gamification (5 to 8), flagged kudos for HR view, semi-public feed.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Linear | Kudos reactions (clap, heart, rocket, bulb) | Lightweight recognition - lower barrier than writing a note. More frequency = more culture. | Low | kudos table exists. Add reaction enum column. UI: emoji picker (reuse Icon sprite). |
| ClickUp | Kudos templates/prompts | 'What did they do?' 'Why did it matter?' - guides meaningful recognition, reduces generic 'thanks'. | Low | KudosClient has compose area. Add prompt chips (reuse Chip component) that insert text. |
| Notion | Kudos collections/pages per project | 'Project Alpha wins' - ties recognition to work output, reinforces desired behaviors. | Low | kudos has no project link. Add nullable project_id FK. Filter in KudosClient + project page. |
| Monday.com | Kudos leaderboards (opt-in, rotating) | Friendly competition - 'Top giver this month', 'Most Went above and beyond'. Rotates to avoid toxicity. | Low | kudos has from_employee_id, tag. Aggregation queries trivial. UI: reuse StatTile + Card. |
| Asana | Milestone celebrations (auto-kudos) | 'Project shipped!' -> auto-suggest kudos to contributors - captures moment, reduces forgetfulness. | Low | task_events has completed. On project completion (all tasks done), trigger suggestion. |
| Jira | Peer bonus/points redemption | Points -> swag, charity, time off - tangible reinforcement. Budget-controlled. | Medium | Needs kudos_points table + redemption catalog. But points = count(kudos) already computable. |
| Linear | Kudos in issue comments ('Great fix!') | Recognition where work happens - not a separate tab. Contextual. | Low | task_comments exists. Add is_kudos flag. Surface in both Task detail + Kudos page. |

---
## PILLAR 6: TASKS (Productivity)
**Current state:** Projects, sections, tasks, subtasks, comments, assignees, priorities (3), due dates, start dates, estimates, labels, task_events audit log, drag-drop board, workload view.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Asana | Task dependencies (blocks/blocked by) | 'I can't start until you finish' - makes invisible wait time visible, reduces blame. | **Already in schema** | tasks.blocked_by FK exists (0011)! Just needs UI in TaskRow/BoardColumn + validation on move. |
| Linear | Issue relations (relates to, duplicates, parent/child) | Context linking - 'this task relates to that bug' reduces duplicate work + cognitive load. | Low | Add task_relations table (source, target, type). UI: relation chips in Task detail (reuse Chip). |
| ClickUp | Recurring tasks | 'Weekly 1:1 prep', 'Monthly report' - reduces admin burden, ensures routine wellbeing tasks exist. | Medium | Schema excluded recurrence (0011 comment). Needs recurrence_rule (RRULE) + cron/worker. Start: manual 'duplicate with date shift' action. |
| Notion | Custom views per person (my tasks by priority, by project, by energy) | Personal workflow - 'Show me only high-energy tasks for morning' aligns work with capacity. | Low | getMyTasks + getTasksForProjectRich exist. Add view presets (saved filters) in localStorage or user_preferences table. |
| Monday.com | Subitems (nested subtasks) | Breaks large tasks down - 'write spec' -> 'outline', 'draft', 'review' - reduces overwhelm. | Medium | subtasks table exists but flat. Add parent_subtask_id self-ref. UI: indent in TaskRow (reuse dnd-kit). |
| Jira | Time tracking (logged vs estimated) | 'Estimated 4h, logged 6h' - calibration improves future estimates -> less overload. | Medium | estimate_hours exists. Add time_entries table (task_id, user_id, hours, date, description). UI: log time button in TaskRow. |
| Asana | Rules/Automation (if X then Y) | 'When task moved to Done -> assign reviewer' - reduces manual coordination overhead. | Medium | task_events log is the trigger source. Add automation_rules table (trigger, condition, action). Execute in server actions. |
| ClickUp | Workload heatmap (calendar view) | Visual 'red week' warning - 'Don't schedule more this week' at a glance. | Low | getWorkloadRich + estimate_hours + due_date = data. Needs calendar heatmap component (reuse Sparkline logic). |
| Linear | Triage inbox (unassigned/new tasks) | 'What needs my attention?' - single place to process, reduces anxiety about missing things. | Low | tasks with assignee_id IS NULL + created_by != me. Add 'Triage' tab in Tasks page. |
| Monday.com | Formulas (rollup: subtask done % -> parent progress) | Auto-progress - '3/5 subtasks done = 60%' - reduces manual updates, shows momentum. | Low | subtasks table exists. Add computed progress_pct in query (or generated column). Show in TaskRow. |
| Notion | Task templates (bug, feature, chore, 1:1 prep) | Standardizes 'definition of ready' - reduces back-and-forth, clearer expectations = less stress. | Low | templates table (name, title_template, description_template, default_labels, default_priority). Create task from template action. |

---

## PILLAR 7: FOCUS MODE (Productivity)
**Current state:** 3 workspace states (standard, focus, calm), adapts to burnout band, manual toggle, reduced motion/color in calm.

| Source System | Feature Name | Wellbeing Value Proposition | Effort | Why Low Effort |
|---------------|--------------|----------------------------|--------|----------------|
| Linear | Keyboard-first everything | Flow state protection - no mouse reaching. Power users stay in focus longer. | Low | FocusClient + BoardClient already use keyboard (dnd-kit). Add global shortcuts (Cmd+K command palette). |
| Notion | Focus mode per page (hide sidebar, full width) | Context-specific - 'This doc needs deep focus' vs 'This board needs overview'. | Low | WORKSPACE_COPY has 3 states. Add per-route override via URL param or localStorage. |
| ClickUp | Distraction-free writing mode | Full-screen, typewriter scrolling - for docs, specs, reflection. Reduces UI anxiety. | Low | FocusClient renders children. Add FocusModeWrapper component that applies CSS focus-mode class. |
| Asana | 'My Tasks' focus view (today/upcoming/later) | Time-horizon filtering - 'What must happen today?' reduces decision fatigue. | Low | getMyTasks returns all. Add client-side tabs: Today (due<=today), Upcoming (due<=7d), Later. |
| Linear | Cycles (sprints) with capacity commit | 'I commit to 20h this cycle' - explicit commitment prevents overcommitment. | Medium | Needs cycles table (start, end, name). tasks -> add cycle_id. But: reuses estimate_hours + weeklyCapacityHours. |
| ClickUp | Pomodoro timer integrated | 25/5 built-in - no context switch to timer app. Auto-logs focus sessions. | Low | NudgeProvider has sessionMinutes, start/pause/reset. Rebrand as Pomodoro + log to focus_sessions table. |
| Monday.com | Focus music/white noise | Auditory masking - reduces environmental distraction, especially open office. | Low | Static assets (audio files). FocusClient -> add audio player component. No backend needed. |
| Jira | Sprint goal visibility | 'This sprint we're fixing checkout bugs' - shared purpose reduces 'why am I doing this?' stress. | Medium | Needs cycles/sprints table. But: projects exist. Add goal text field to project. Show in Focus Mode header. |

---
## CROSS-PILLAR FEATURES (Multiple Pillars)

| Source System | Feature Name | Pillars Enhanced | Wellbeing Value Proposition | Effort |
|---------------|--------------|------------------|----------------------------|--------|
| All | Command Palette (Cmd+K) | Tasks, Focus, Nudges, Boundary | Speed + keyboard-first = flow preservation, reduced friction | Low (reuse @dnd-kit patterns, add cmdk lib) |
| Linear/Notion | Deep linking + shareable views | All | 'Here's my burnout view filtered to my team' - collaboration without screenshots | Low (Next.js routes already support params) |
| ClickUp/Asana | Home/Dashboard customization | Dashboard, Focus | Personal relevance - 'Show me only what I care about' reduces cognitive load | Medium (needs user_dashboard_config JSON column) |
| Notion | Templates gallery | Tasks, Kudos, Mood, Boundary | Reduces blank-page paralysis - 'Start from Weekly 1:1' | Low (JSON files in lib/templates/, UI in each pillar) |
| All | Mobile-responsive improvements | All | Wellbeing happens on phone too - 'Log mood on commute', 'Snooze nudge on walk' | Medium (Tailwind v4 responsive, but some components need touch optimization) |
| Linear | Inbox/Notifications center | Nudges, Boundary, Tasks, Kudos | Single place for 'things needing me' - reduces tab switching anxiety | Medium (needs notifications table + realtime. Start: polling + dropdown) |

---

## EFFORT CALIBRATION NOTES

**Low Effort** = 
- Schema change only (column, index, constraint)
- Reuses existing queries/components/patterns
- Pure client-side logic (constants, utils, React state)
- Server action follows existing patterns (withEmployee, validated, revalidatePath)
- < 2 days for experienced dev

**Medium Effort** = 
- New table + RLS policies + queries
- New client component with non-trivial state
- Background job / cron / Edge Function needed
- Integration with external service (calendar, email, Slack)
- 3-7 days

**High Effort** = 
- Major architectural change (realtime, websocket, worker)
- Multi-table schema with complex relations
- New authentication/authorization model
- Significant UX redesign
- > 1 week

---

## PRIORITIZATION FRAMEWORK

**Quick Wins (Low effort, high wellbeing impact):**
1. Task dependencies UI (blocked_by exists!) -> Tasks + Burnout
2. Nudge keyboard dismissal -> Nudges
3. Mood tags -> Mood
4. Kudos reactions -> Kudos
5. Custom task views (saved filters) -> Tasks + Focus
6. Focus mode per-route -> Focus
7. Urgent/Normal toggle in Boundary -> Boundary
8. Workload heatmap calendar -> Tasks + Burnout
9. Subtask progress rollup -> Tasks
10. Task templates -> Tasks

**Strategic Investments (Medium effort, systemic impact):**
1. Time tracking (logged vs estimated) -> Tasks + Burnout
2. Recurring tasks (manual duplicate first) -> Tasks
3. Automation rules engine -> Tasks + Nudges + Boundary
4. Command palette -> All
5. Notification inbox -> Nudges + Boundary + Tasks + Kudos
6. Cycle/sprint commitment -> Focus + Tasks + Burnout

---

## IMPLEMENTATION ORDER SUGGESTION

**Week 1-2 (Quick wins):**
- Task dependencies UI
- Nudge keyboard shortcuts
- Mood tags
- Kudos reactions
- Urgent/Normal in Boundary

**Week 3-4:**
- Custom task views (saved filters)
- Focus mode per-route
- Workload heatmap
- Subtask progress rollup
- Task templates

**Month 2:**
- Time tracking MVP
- Automation rules (trigger: task_events)
- Command palette
- Notification inbox (polling)

**Month 3+:**
- Recurring tasks (with cron)
- Cycles/sprints
- Deep calendar integration
