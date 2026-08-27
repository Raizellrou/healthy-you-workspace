-- P3: the task engine. Tasks stop being a bare title/assignee/priority row
-- and become the thing that feeds the six wellbeing pillars — estimates for
-- Workload/capacity, completed_at for velocity, and an append-only
-- task_events log that later phases (burnout v2, nudges, timeline) read
-- rather than recomputing from task rows directly.
--
-- Deliberately NOT included, by design:
--   - recurrence / recurrence_parent_id — no phase in the current roadmap
--     generates recurring tasks yet (no cron exists to do it from — see the
--     P6 "no background worker" decision), so this would be a dead column
--     with no writer. Add it in the migration that actually builds that
--     feature.
--   - task_watchers — same reasoning: nothing reads a watcher list until a
--     notification system exists (P6). Adding it now means schema nobody
--     exercises, so it's deferred there.

-- --- tasks: new columns -----------------------------------------------------

alter table public.tasks
  add column if not exists start_date date,
  add column if not exists estimate_hours numeric(5,2),
  add column if not exists completed_at timestamptz,
  add column if not exists blocked_by uuid references public.tasks(id) on delete set null;

do $$ begin
  alter table public.tasks
    add constraint tasks_estimate_hours_check check (estimate_hours is null or estimate_hours >= 0);
exception when duplicate_object or duplicate_table then null;
end $$;

-- Length CHECKs AGENTS.md flags as missing — title/description had no limit
-- at the database level before this.
do $$ begin
  alter table public.tasks
    add constraint tasks_title_length_check check (char_length(title) between 1 and 200);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.tasks
    add constraint tasks_description_length_check check (description is null or char_length(description) <= 5000);
exception when duplicate_object or duplicate_table then null;
end $$;

create index if not exists tasks_blocked_by_idx on public.tasks(blocked_by);
create index if not exists tasks_due_date_open_idx on public.tasks(due_date) where done = false;

-- --- triggers ----------------------------------------------------------------
--
-- The repo has zero triggers on tasks today: updated_at is set by hand only
-- in updateTask, so toggleDone and moveTask silently leave it stale. Moving
-- it into a trigger fixes that for every current and future write path in
-- one place, instead of one more action remembering to set it.

create or replace function public.tasks_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at_trigger on public.tasks;
create trigger tasks_touch_updated_at_trigger
  before update on public.tasks
  for each row
  execute function public.tasks_touch_updated_at();

-- completed_at is what makes "closed 4 tasks at 23:40" measurable later
-- (burnout v2's off-hours task activity signal). TG_OP short-circuits the OR
-- so `old.done` is never evaluated on INSERT, where OLD isn't bound —
-- the same bug class 0009's employees_sync_team_name trigger hit.
create or replace function public.tasks_set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or old.done is distinct from new.done then
    if new.done then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_completed_at_trigger on public.tasks;
create trigger tasks_set_completed_at_trigger
  before insert or update on public.tasks
  for each row
  execute function public.tasks_set_completed_at();

-- --- labels ------------------------------------------------------------------

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#64748b'
);

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);
create index if not exists task_labels_label_id_idx on public.task_labels(label_id);

-- --- task_events: append-only audit log --------------------------------------
--
-- task_id is nullable with ON DELETE SET NULL, not CASCADE — a 'deleted'
-- event is written right before the task row goes away, and the log is
-- meant to survive the task it describes (that's the point of an audit
-- log). CASCADE would delete the very row recording the deletion.
--
-- is_off_hours is computed in the server action (lib/tasks.ts), using the
-- actor's timezone, not here — that logic needs to be unit-testable and a
-- SQL trigger can't easily reach lib/date.ts's Intl-based zone math.

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  actor_id uuid not null references public.employees(id),
  kind text not null check (kind in (
    'created', 'completed', 'reopened', 'assigned', 'unassigned', 'moved',
    'commented', 'due_changed', 'priority_changed', 'estimate_changed', 'deleted'
  )),
  from_value text,
  to_value text,
  is_off_hours boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists task_events_actor_id_created_at_idx on public.task_events(actor_id, created_at desc);
create index if not exists task_events_task_id_created_at_idx on public.task_events(task_id, created_at desc);

-- --- reorder_section RPC -------------------------------------------------------
--
-- Replaces moveTask's N sequential UPDATEs (one per task in the target
-- column, each a separate round trip and non-transactional against each
-- other) with one statement. SECURITY INVOKER (the default — stated
-- explicitly here) so it still runs as the calling user and stays subject
-- to the existing "tasks updatable by authenticated" RLS policy, same as
-- every other task write.

create or replace function public.reorder_section(p_section_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security invoker
as $$
begin
  update public.tasks t
  set section_id = p_section_id,
      position = x.ord - 1
  from unnest(p_ordered_ids) with ordinality as x(id, ord)
  where t.id = x.id;
end;
$$;

revoke execute on function public.reorder_section(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_section(uuid, uuid[]) to authenticated;

-- --- RLS -----------------------------------------------------------------------
--
-- labels/task_labels: same shared-board trust model as projects/board_sections
-- (0007) — org-readable, org-writable, no per-row owner.
--
-- task_events: readable org-wide (matches task visibility — anyone who can
-- see a task can see its history), insertable only as yourself, and
-- deliberately has NO update or delete policy. That absence is the
-- append-only guarantee: even a compromised or buggy client can add rows to
-- the log, never rewrite or erase one.

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_events enable row level security;

create policy "labels readable by authenticated"
  on public.labels for select to authenticated using (true);
create policy "labels modifiable by authenticated"
  on public.labels for all to authenticated using (true) with check (true);

create policy "task_labels readable by authenticated"
  on public.task_labels for select to authenticated using (true);
create policy "task_labels modifiable by authenticated"
  on public.task_labels for all to authenticated using (true) with check (true);

create policy "task_events readable by authenticated"
  on public.task_events for select to authenticated using (true);
create policy "users can insert task_events as themselves"
  on public.task_events for insert to authenticated with check (
    actor_id in (select id from public.employees where auth_user_id = auth.uid())
  );
