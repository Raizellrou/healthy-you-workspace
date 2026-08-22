-- P7: making every pillar read and write persisted state instead of
-- client-only simulation. Burnout/Predict is not touched here — P4 already
-- gave it real inputs and a base-vs-task-aware comparison in the UI
-- (lib/burnout-signals.ts, app/(app)/burnout/BurnoutClient.tsx); there is
-- nothing left in this migration for that pillar.
--
-- Deliberately NOT included, by design (same "no dead schema" call made in
-- every prior phase):
--   - calendar_events — still no reader. Focus Mode's timeline below is
--     built from real work_sessions/session_breaks/tasks instead of
--     simulated meeting blocks, which needs no calendar table at all.
--   - nudge_preferences.respect_calendar — same reason; there is no
--     calendar signal to respect. respect_focus is kept because
--     focus_sessions (this migration) gives it something real to check.
--   - nudge_events.delivered_at — the baseline table already has
--     triggered_at doing that job; adding a second column with the same
--     meaning would be dead duplication, not a schema gap.
--   - coffee_chats scheduling into a "mutual calendar gap" — no calendar
--     data to find a gap in. Scheduling here is a plain proposed date/time
--     the two people agree on, not calendar-derived.
--   - A dedicated recognition-drought signal for HR — real, but additive
--     and independent of everything else here; left for a later pass
--     rather than bolted onto this already-large migration.

-- --- nudge_events / nudge_preferences: extend for real persistence -------

alter table public.nudge_events
  add column if not exists result text check (result in ('sent', 'suppressed', 'done', 'snoozed')),
  add column if not exists reason text,
  add column if not exists session_id uuid references public.work_sessions(id),
  add column if not exists responded_at timestamptz;

alter table public.nudge_preferences
  add column if not exists types_enabled text[] not null default array['stretch', 'hydrate', 'eye_rest', 'posture'],
  add column if not exists cadence_minutes integer not null default 50,
  add column if not exists daily_cap integer not null default 6,
  add column if not exists respect_focus boolean not null default true;

-- --- focus_sessions --------------------------------------------------------
--
-- A focus_sessions table already existed, undocumented, from before this
-- migrations/ directory started (0008's own header comment flagged it,
-- alongside concern_flags, as "belongs in its own migration once that's
-- designed" — this is that migration). Its real shape (id, employee_id,
-- date, start_time, end_time, notifications_batched, deep_work,
-- created_at) doesn't match what this phase needs, it has zero RLS
-- policies, and no application code anywhere references it. Confirmed 0
-- rows via a scoped read-only check before writing this — dropping and
-- recreating with the real shape below loses nothing.

drop table if exists public.focus_sessions;

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null check (mode in ('standard', 'focus', 'calm')),
  trigger text not null check (trigger in ('manual', 'auto_burnout', 'auto_meeting_free')),
  tasks_completed integer not null default 0,
  notifications_suppressed integer not null default 0
);
create unique index if not exists focus_sessions_one_open_idx
  on public.focus_sessions(employee_id) where ended_at is null;

alter table public.focus_sessions enable row level security;

create policy "focus_sessions readable by self, team, or org per can_see_employee"
  on public.focus_sessions for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

create policy "focus_sessions insertable by self"
  on public.focus_sessions for insert
  to authenticated
  with check (employee_id = (select public.current_employee_id()));

create policy "focus_sessions updatable by self"
  on public.focus_sessions for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));

-- --- ui_preferences ----------------------------------------------------------

create table if not exists public.ui_preferences (
  employee_id uuid primary key references public.employees(id),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  font_scale numeric(3, 2) not null default 1.0,
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  single_column boolean not null default false,
  muted_palette boolean not null default false,
  hide_avatars boolean not null default false,
  default_task_view text not null default 'board' check (default_task_view in ('list', 'board', 'calendar', 'timeline')),
  created_at timestamptz not null default now()
);

insert into public.ui_preferences (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

alter table public.ui_preferences enable row level security;

create policy "ui_preferences readable and writable by self"
  on public.ui_preferences for select
  to authenticated
  using (employee_id = (select public.current_employee_id()));

create policy "ui_preferences updatable by self"
  on public.ui_preferences for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));

-- --- buddy_pairings ----------------------------------------------------------
--
-- No INSERT policy for `authenticated` at all — the only sanctioned writer
-- is rotate_buddies() below, a security definer function that checks
-- is_hr() internally. Direct table writes stay impossible from the client
-- even though reads are org-wide (this is team-building visibility, the
-- same trust level as kudos, not a private signal).

create table if not exists public.buddy_pairings (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  employee_a uuid not null references public.employees(id),
  employee_b uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  check (employee_a <> employee_b),
  unique (week_start, employee_a),
  unique (week_start, employee_b)
);

alter table public.buddy_pairings enable row level security;

create policy "buddy_pairings readable by any authenticated user"
  on public.buddy_pairings for select
  to authenticated
  using (true);

-- --- coffee_chats ------------------------------------------------------------

create table if not exists public.coffee_chats (
  id uuid primary key default gen_random_uuid(),
  proposer_id uuid not null references public.employees(id),
  invitee_id uuid not null references public.employees(id),
  proposed_at timestamptz not null default now(),
  scheduled_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'completed')),
  check (proposer_id <> invitee_id)
);

alter table public.coffee_chats enable row level security;

create policy "coffee_chats readable by proposer or invitee"
  on public.coffee_chats for select
  to authenticated
  using (
    proposer_id = (select public.current_employee_id())
    or invitee_id = (select public.current_employee_id())
  );

create policy "coffee_chats insertable by the proposer"
  on public.coffee_chats for insert
  to authenticated
  with check (proposer_id = (select public.current_employee_id()));

create policy "coffee_chats updatable by proposer or invitee"
  on public.coffee_chats for update
  to authenticated
  using (
    proposer_id = (select public.current_employee_id())
    or invitee_id = (select public.current_employee_id())
  )
  with check (
    proposer_id = (select public.current_employee_id())
    or invitee_id = (select public.current_employee_id())
  );

-- --- concern_flags -----------------------------------------------------------
--
-- The real replacement for the kudos.flagged hack. `raised_by_id` nullable
-- means anonymous — the app decides whether to send it, but the database
-- is what actually enforces that nobody except HR can ever read this table,
-- named submissions included. That's the difference between "the UI
-- promises anonymity" and "anonymity is a database constraint."
--
-- Same situation as focus_sessions above: an undocumented concern_flags
-- table already existed (0008 flagged it, zero RLS, real shape id/
-- flagged_employee_id/flagged_by_employee_id/created_at/note/status — no
-- category, no acknowledged_by/at). No application code references it.
-- Confirmed 0 rows before writing this; dropping and recreating with the
-- real shape below loses nothing.

drop table if exists public.concern_flags;

create table public.concern_flags (
  id uuid primary key default gen_random_uuid(),
  about_employee_id uuid not null references public.employees(id),
  raised_by_id uuid references public.employees(id),
  category text not null check (category in ('workload', 'conduct', 'wellbeing', 'other')),
  note text not null check (char_length(note) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  acknowledged_by uuid references public.employees(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.concern_flags enable row level security;

create policy "concern_flags insertable as self or anonymously"
  on public.concern_flags for insert
  to authenticated
  with check (
    raised_by_id is null or raised_by_id = (select public.current_employee_id())
  );

create policy "concern_flags readable only by HR"
  on public.concern_flags for select
  to authenticated
  using ((select public.is_hr()));

create policy "concern_flags updatable only by HR"
  on public.concern_flags for update
  to authenticated
  using ((select public.is_hr()))
  with check ((select public.is_hr()));

-- --- mood_checkins: add energy (note already exists from 0008) -------------

alter table public.mood_checkins
  add column if not exists energy smallint check (energy between 1 and 5);

-- --- notifications: two new values on top of 0014's CHECK constraints ------
--
-- 'message_held' — Right to Disconnect now writes a real notification when
-- a boundary message is delayed, so the recipient can see "held until
-- Monday 9:00" in their own inbox instead of only the sender's activity
-- log. 'focus_session' — a hold that can't be resolved by elapsed time the
-- way quiet-hours can (nobody knows in advance when a focus session ends),
-- so it's released explicitly by app/(app)/focus/actions.ts#endFocusSession
-- setting deliver_after = now() on every notification it holds, not by a
-- background job. Dropping and recreating a CHECK constraint to widen its
-- allowed values is the same pattern 0005_kudos_type_constraint.sql already
-- used for kudos_type.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held'));

alter table public.notifications drop constraint if exists notifications_held_reason_check;
alter table public.notifications
  add constraint notifications_held_reason_check
  check (held_reason in ('quiet_hours', 'batched', 'focus_session'));

-- --- get_notification_schedule: widen with a focus-session flag ------------
--
-- Evolving an existing security definer function, not a new migration file
-- editing 0015 — 0015 stays exactly as applied, only the function it
-- created changes. Postgres won't CREATE OR REPLACE a function into a
-- different return row shape (0015's version returns 7 columns, this one
-- returns 8) — it requires an explicit DROP first.

drop function if exists public.get_notification_schedule(uuid);

create function public.get_notification_schedule(target_employee_id uuid)
returns table (
  workdays smallint[],
  start_min integer,
  end_min integer,
  quiet_start_min integer,
  quiet_end_min integer,
  batching_mode text,
  muted_kinds text[],
  focus_session_open boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(ws.workdays, '{1,2,3,4,5}'::smallint[]),
    coalesce(ws.start_min, 540),
    coalesce(ws.end_min, 1080),
    coalesce(ws.quiet_start_min, 1200),
    coalesce(ws.quiet_end_min, 480),
    coalesce(np.batching_mode, 'immediate'),
    coalesce(np.muted_kinds, '{}'::text[]),
    exists (
      select 1 from public.focus_sessions fs
      where fs.employee_id = e.id and fs.ended_at is null
    )
  from public.employees e
  left join public.work_schedules ws on ws.employee_id = e.id
  left join public.notification_prefs np on np.employee_id = e.id
  where e.id = target_employee_id;
$$;

grant execute on function public.get_notification_schedule(uuid) to authenticated;

-- --- RPCs: mood streak, org mood trend, buddy rotation ----------------------

-- Not security definer: mood_checkins RLS already scopes SELECT to the
-- caller's own rows, so this naturally only ever streaks the caller's own
-- check-ins — the same self-only boundary the table already enforces, not
-- a new one.
create or replace function public.get_mood_streak(target_employee_id uuid)
returns integer
language plpgsql
stable
as $$
declare
  streak integer := 0;
  cursor_date date := current_date;
  has_checkin boolean;
begin
  loop
    select exists(
      select 1 from public.mood_checkins
      where employee_id = target_employee_id and date = cursor_date
    ) into has_checkin;
    exit when not has_checkin;
    streak := streak + 1;
    cursor_date := cursor_date - 1;
  end loop;
  return streak;
end;
$$;

grant execute on function public.get_mood_streak(uuid) to authenticated;

-- Security definer, the same n>=3 anti-de-anonymization gate as
-- get_team_mood_aggregate — this reads every employee's mood_checkins row
-- to aggregate, which per-row RLS would otherwise block for anyone but HR.
create or replace function public.get_org_mood_trend(days integer default 30)
returns table (day date, avg_mood numeric, checkin_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.date as day,
    case when count(mc.id) >= 3 then round(avg(mc.mood_value), 1) else null end as avg_mood,
    count(mc.id)::integer as checkin_count
  from generate_series(current_date - (days - 1), current_date, interval '1 day') as d(date)
  left join public.mood_checkins mc on mc.date = d.date::date
  group by d.date
  order by d.date;
$$;

grant execute on function public.get_org_mood_trend(integer) to authenticated;

-- HR-only, security definer so it can both read every employee (for the
-- shuffle) and write buddy_pairings, which has no direct INSERT policy.
-- Re-running for a week that already has pairings replaces them rather
-- than erroring, so a mis-click doesn't need a manual cleanup script.
create or replace function public.rotate_buddies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  wk date := date_trunc('week', current_date)::date;
  ids uuid[];
  n integer;
  i integer;
  pairs_made integer := 0;
begin
  if not (select public.is_hr()) then
    raise exception 'Only HR can rotate buddy pairings';
  end if;

  delete from public.buddy_pairings where week_start = wk;

  select array_agg(id order by random()) into ids from public.employees;
  n := array_length(ids, 1);
  if n is null or n < 2 then
    return 0;
  end if;

  i := 1;
  while i + 1 <= n loop
    insert into public.buddy_pairings (week_start, employee_a, employee_b)
    values (wk, ids[i], ids[i + 1]);
    pairs_made := pairs_made + 1;
    i := i + 2;
  end loop;

  return pairs_made;
end;
$$;

grant execute on function public.rotate_buddies() to authenticated;

-- --- get_recipient_availability ---------------------------------------------
--
-- Right to Disconnect needs to know a recipient's real schedule/timezone
-- and whether they're on approved PTO right now — but pto_requests SELECT
-- is can_see_employee-scoped (0012), which a random peer composing a
-- message to a non-teammate won't satisfy. Same actor/recipient RLS trap
-- 0015 fixed for the notification funnel, same fix: a narrow security
-- definer lookup, not a loosened table policy. Distinct from
-- get_notification_schedule() (0015/this file) on purpose — that one
-- answers "how should a notification to this person be delayed", this one
-- answers "can I reach this person right now", and conflating the two
-- under one name would make either call site harder to read.
create or replace function public.get_recipient_availability(target_employee_id uuid)
returns table (
  timezone text,
  workdays smallint[],
  start_min integer,
  end_min integer,
  on_pto boolean,
  pto_return_date date
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(e.timezone, 'Asia/Manila'),
    coalesce(ws.workdays, '{1,2,3,4,5}'::smallint[]),
    coalesce(ws.start_min, 540),
    coalesce(ws.end_min, 1080),
    exists (
      select 1 from public.pto_requests p
      where p.employee_id = e.id
        and p.status = 'approved'
        and current_date between p.start_date and p.end_date
    ),
    (
      select min(p.end_date) + 1
      from public.pto_requests p
      where p.employee_id = e.id
        and p.status = 'approved'
        and current_date between p.start_date and p.end_date
    )
  from public.employees e
  left join public.work_schedules ws on ws.employee_id = e.id
  where e.id = target_employee_id;
$$;

grant execute on function public.get_recipient_availability(uuid) to authenticated;

-- --- get_boundary_offhours_rate ----------------------------------------------
--
-- HR-only trend: delayed-send rate by team, over the trailing window.
-- boundary_events stays sender-only SELECT (0003 — "a personal recent
-- activity log, not an org-wide feed"); this is a security definer
-- aggregate, the same shape as get_team_mood_aggregate, so HR gets a team
-- trend without opening up individual boundary_events rows to anyone.
create or replace function public.get_boundary_offhours_rate(days integer default 30)
returns table (team text, total_sent bigint, delayed_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.team,
    count(*) as total_sent,
    count(*) filter (where be.action = 'delayed') as delayed_count
  from public.boundary_events be
  join public.employees e on e.id = be.sender_id
  where public.is_hr()
    and be.sent_at >= now() - (days || ' days')::interval
  group by e.team
  order by e.team;
$$;

grant execute on function public.get_boundary_offhours_rate(integer) to authenticated;
