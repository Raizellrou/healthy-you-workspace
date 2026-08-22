-- P6: the one notification funnel. Every notification insert is meant to
-- go through lib/notify.ts#enqueue() (app layer, not this migration), which
-- computes deliver_after via lib/schedule.ts#resolveDeliverAfter — quiet
-- hours / non-working-hours always win, then batching_mode gets a say.
-- Right to Disconnect, Nudges, and any future digest feature become
-- policies over this one mechanism, not three separate ones.
--
-- No background worker, no cron: delivery is computed at READ time. The
-- inbox's Unread tab reads `where deliver_after <= now()`; Held for later
-- reads the opposite. A row "moves" from held to unread with nothing
-- running, purely because now() advanced past it.
--
-- Deliberately NOT included, by design:
--   - calendar_events — the original plan wanted this here for future
--     nudge-suppression/focus-timeline use, but nothing in this phase
--     reads or writes it. Dead schema with no reader is exactly what P3
--     already skipped recurrence/task_watchers for; same call here.
--     Add it in the migration that actually consumes it (P7).
--   - notifications.batch_id and batching_mode = 'end_of_focus' — no
--     focus_sessions table exists yet (P7), so "hold until focus ends"
--     has nothing to check. 'hourly' and 'daily_digest' are implemented
--     as deliver_after rounding (see lib/schedule.ts), which needs no
--     batch grouping at all — every notification still lands in the
--     inbox individually once its own deliver_after passes.
--   - a timezone column on work_schedules — employees.timezone (P2)
--     already exists; duplicating it here would just be a second place
--     for the same fact to go stale. lib/schedule.ts takes timezone as a
--     parameter instead.
--   - realtime — `alter publication supabase_realtime add table
--     notifications` is a one-line, purely additive change to make later
--     if a live-updating badge turns out to be worth the added
--     client-side subscription code. The inbox badge refreshes the same
--     way every other Sidebar badge already does: on navigation.

create table public.work_schedules (
  employee_id uuid primary key references public.employees(id),
  workdays smallint[] not null default '{1,2,3,4,5}',
  start_min integer not null default 540,
  end_min integer not null default 1080,
  quiet_start_min integer not null default 1200,
  quiet_end_min integer not null default 480,
  created_at timestamptz not null default now()
);

create table public.notification_prefs (
  employee_id uuid primary key references public.employees(id),
  batching_mode text not null default 'immediate' check (batching_mode in ('immediate', 'hourly', 'daily_digest')),
  muted_kinds text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Backfilled for every employee in this same migration, so the app never
-- has to handle a missing schedule/prefs row as a special case.
insert into public.work_schedules (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

insert into public.notification_prefs (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.employees(id),
  actor_id uuid references public.employees(id),
  kind text not null check (kind in ('task_assigned', 'mention', 'pto_decided', 'due_soon')),
  title text not null,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  deliver_after timestamptz not null default now(),
  held_reason text check (held_reason in ('quiet_hours', 'batched')),
  read_at timestamptz,
  dismissed_at timestamptz
);
create index notifications_recipient_deliver_after_idx
  on public.notifications(recipient_id, deliver_after desc)
  where read_at is null;

create table public.mentions (
  comment_id uuid not null references public.task_comments(id) on delete cascade,
  mentioned_employee_id uuid not null references public.employees(id),
  primary key (comment_id, mentioned_employee_id)
);

-- --- RLS -----------------------------------------------------------------

alter table public.work_schedules enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notifications enable row level security;
alter table public.mentions enable row level security;

-- Personal settings, not an org-visible signal — self only, unlike
-- daily_activity/work_sessions' can_see_employee scoping.
create policy "work_schedules readable and writable by self"
  on public.work_schedules for select
  to authenticated
  using (employee_id = (select public.current_employee_id()));
create policy "work_schedules updatable by self"
  on public.work_schedules for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));

create policy "notification_prefs readable and writable by self"
  on public.notification_prefs for select
  to authenticated
  using (employee_id = (select public.current_employee_id()));
create policy "notification_prefs updatable by self"
  on public.notification_prefs for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));

-- An inbox is inherently private — unlike every other table in this
-- schema, there is no "manager/HR can also see this" case.
create policy "notifications readable by recipient"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select public.current_employee_id()));

-- The actor (assigning a task, mentioning someone) creates a notification
-- FOR someone else, so the insert can't be scoped to recipient_id = self
-- the way boundary_events scopes to sender_id = self — this is the same
-- shape, just naming the acting party `actor_id` instead of `sender_id`.
-- `recipient_id = self` is also allowed for self-generated system rows
-- (the due_soon sweep runs as the viewer reading their own inbox).
create policy "notifications insertable by the actor or for yourself"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = (select public.current_employee_id())
    or recipient_id = (select public.current_employee_id())
  );

create policy "notifications updatable by recipient"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select public.current_employee_id()))
  with check (recipient_id = (select public.current_employee_id()));

-- Mentions ride on task_comments' existing org-readable trust model (0007)
-- — anyone who can read the comment can see who was tagged in it.
create policy "mentions readable by authenticated"
  on public.mentions for select
  to authenticated
  using (true);
create policy "mentions insertable by the comment's author"
  on public.mentions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.task_comments c
      where c.id = mentions.comment_id
        and c.author_id = (select public.current_employee_id())
    )
  );
