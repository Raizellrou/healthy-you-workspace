-- Adds the one nudge preference 0016 deliberately left out.
--
-- 0016's header says it plainly: "nudge_preferences.respect_calendar —
-- same reason; there is no calendar signal to respect. respect_focus is
-- kept because focus_sessions gives it something real to check." That was
-- correct then. 0022_calendar_events.sql created the signal, so the
-- preference now has something to mean, and this is the migration that
-- consumes it — same rule the calendar table itself waited on.
--
-- Default true: being interrupted by a stretch reminder mid-meeting is the
-- behaviour nobody wants, so the useful setting is the one you get without
-- configuring anything. Turning it OFF is the deliberate act.

alter table public.nudge_preferences
  add column if not exists respect_calendar boolean not null default true;

-- Backfill: nudge_preferences turned out to hold ZERO rows for 24
-- employees. It predates the convention every later preferences table
-- follows — work_schedules, notification_prefs and ui_preferences each
-- backfilled everyone in the migration that created them, specifically so
-- there is never a null-preference code path. Without this, a column
-- default on an empty table defaults nothing: respect_calendar would be
-- unreachable and unsettable, permanently pinned to the reader's fallback.
insert into public.nudge_preferences (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

-- Also unblocks the other thing 0016 deferred for want of a calendar:
-- coffee_chats shipped complete, with RLS, and no reader, because
-- "scheduling into a mutual calendar gap" had no calendar to look in.
-- app/(app)/kudos/actions.ts#proposeCoffee is that reader now, so the
-- invitee needs a notification kind for it.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held',
    'task_reassigned', 'intervention_suggested', 'one_on_one_scheduled', 'coffee_proposed'
  ));
