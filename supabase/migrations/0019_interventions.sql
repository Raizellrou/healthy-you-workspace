-- P8 item 3: the intervention engine. Turns a burnout score into a tracked
-- workflow instead of just a number on a dashboard: a manager/HR viewer
-- sees "driven mainly by X" and can create a concrete, trackable action —
-- for the streak/pto drivers that's an immediate pending PTO request
-- pre-filled on the person's behalf; for every other driver it's a
-- suggestion the subject (or their manager) later accepts or dismisses.

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_by uuid not null references public.employees(id),
  driver text not null check (driver in ('streak', 'meeting', 'offHours', 'pto', 'taskLoad', 'overdue', 'recovery')),
  action_type text not null check (
    action_type in ('schedule_pto', 'reduce_meetings', 'strict_quiet_hours', 'rebalance_tasks', 'resolve_overdue', 'general_checkin')
  ),
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dismissed')),
  score_at_creation integer not null,
  note text,
  related_pto_request_id uuid references public.pto_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index interventions_employee_id_idx on public.interventions(employee_id);

alter table public.interventions enable row level security;

create policy "interventions readable by can_see_employee"
  on public.interventions for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

-- Only a manager/HR can raise one — mirrors pto_requests' own "who can act
-- on someone else's record" boundary rather than inventing a new one.
create policy "interventions insertable by manager or hr"
  on public.interventions for insert
  to authenticated
  with check ((select public.manages(employee_id)) or (select public.is_hr()));

-- Resolving it (accept/dismiss) is open to the subject too: for
-- action_type='strict_quiet_hours' specifically, only the subject's own
-- app-level action ever touches their work_schedules row (self-only RLS,
-- untouched by this migration) — this table just tracks that they did.
create policy "interventions updatable by self, manager, or hr"
  on public.interventions for update
  to authenticated
  using (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  );

-- A manager/HR pre-filling a PTO request for someone showing a burnout
-- streak is the one immediate, no-extra-consent action this feature takes
-- (the request still needs approval like any other — see 0012's existing
-- "updatable by self, manager, or hr" policy). Insert was previously
-- self-only; this widens it symmetrically with that existing UPDATE policy.
drop policy if exists "pto_requests insertable by self" on public.pto_requests;
create policy "pto_requests insertable by self, manager, or hr"
  on public.pto_requests for insert
  to authenticated
  with check (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  );

-- New notification kind: telling the subject a manager/HR flagged
-- something for them, distinct from every existing kind (none of which
-- mean "someone raised a burnout intervention involving you").
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held', 'task_reassigned', 'intervention_suggested'));
