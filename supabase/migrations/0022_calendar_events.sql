-- P8 item 6: meeting-load reduction.
--
-- This is the migration that finally consumes calendar_events. It was
-- deliberately skipped in 0014 and again in 0016, both times under the same
-- rule this project has applied since P3: no dead schema, add a table in
-- the migration that actually reads it. Nothing read it until now.
--
-- What forces it now: every metric worth having here needs meeting
-- *boundaries*, not a daily total. "Nobody on this team had a single
-- uninterrupted 90-minute block this week" cannot be derived from
-- daily_activity.meeting_hours, because an aggregate has no times attached
-- — 4 hours of meetings is a wrecked day or a quiet one depending entirely
-- on whether it lands as one block or eight.
--
-- HONESTY NOTE, and it belongs in the schema rather than only in the UI:
-- the per-day meeting TOTALS in this table are real, in the sense that
-- scripts/seed-calendar.ts reconciles every employee-day to that person's
-- already-recorded daily_activity.meeting_hours. The placement of blocks
-- WITHIN each day is modelled, not observed — this project has no calendar
-- integration and never claimed one. So aggregates over this table (load,
-- cost, hours per team) are as trustworthy as the underlying activity
-- data, while anything reading exact start/end times is reasoning about a
-- plausible reconstruction. app/(app)/meetings/page.tsx states this on the
-- screen itself; do not remove that notice without removing the claims it
-- qualifies.

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'meeting' check (kind in ('meeting', 'focus_block', 'ooo', 'one_on_one')),
  -- Non-null when this event is one instance of a repeating series. Shared
  -- across instances so the recurring-meeting audit can group them without
  -- string-matching titles.
  series_id uuid,
  attendee_count integer not null default 1 check (attendee_count >= 1),
  organiser_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint calendar_events_ends_after_start check (ends_at > starts_at)
);

create index calendar_events_employee_starts_idx on public.calendar_events(employee_id, starts_at desc);
create index calendar_events_series_idx on public.calendar_events(series_id) where series_id is not null;

alter table public.calendar_events enable row level security;

-- Same visibility rule as every other behavioural signal (0010): yourself,
-- your team if you manage it, everything if HR. A calendar is exactly the
-- kind of data that must not be org-readable by default.
create policy "calendar_events readable by can_see_employee"
  on public.calendar_events for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

create policy "calendar_events insertable by self"
  on public.calendar_events for insert
  to authenticated
  with check (employee_id = (select public.current_employee_id()));

create policy "calendar_events updatable by self"
  on public.calendar_events for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));

create policy "calendar_events deletable by self"
  on public.calendar_events for delete
  to authenticated
  using (employee_id = (select public.current_employee_id()));
