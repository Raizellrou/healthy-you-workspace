-- P8 item 5: the manager 1:1 surface.
--
-- Closes the loop the rest of the app opens. Burnout scoring, the
-- rebalancer, and the intervention engine all detect things; this is where
-- a manager and a person actually talk about them, with the signals
-- assembled into an agenda instead of a manager having to remember to
-- check six screens first.
--
-- Two deliberate departures from the original plan sketch, both of which
-- are privacy decisions rather than scope cuts:
--
-- 1. NO INDIVIDUAL MOOD ON THE AGENDA. The sketch listed "mood dip" as an
--    agenda signal. mood_checkins is self-only RLS (0003), and every mood
--    aggregate in this product is gated at n>=3 (get_team_mood_aggregate,
--    get_org_mood_trend) specifically so nobody can back out an
--    individual's answer. Putting "their mood dipped" in front of their
--    manager would break the exact promise the mood pillar makes to the
--    person filling it in — and it would make the check-in worth lying to.
--    Every other agenda signal below is already manager-visible under
--    0010's can_see_employee(), so the agenda stays rich without it.
--
-- 2. NO PRIVATE MANAGER NOTES. There is one `shared_notes` column, readable
--    by both parties, and the employee can always read their own 1:1 rows
--    including the agenda that was generated about them. A manager-only
--    notes field would make this a hidden file on an employee, assembled
--    from automated behavioural signals — precisely the thing this product
--    argues it is not. If that changes, it should change deliberately and
--    be disclosed on the transparency page, not arrive as a schema detail.

create table public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.employees(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  scheduled_for date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  -- Snapshot of the generated agenda at scheduling time. Stored rather than
  -- recomputed at read time so the record shows what was actually true when
  -- the conversation was set up, not what the numbers drifted to afterwards.
  agenda jsonb not null default '[]'::jsonb,
  shared_notes text check (shared_notes is null or char_length(shared_notes) <= 5000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint one_on_ones_not_self check (manager_id <> employee_id)
);

create index one_on_ones_employee_id_idx on public.one_on_ones(employee_id);
create index one_on_ones_manager_idx on public.one_on_ones(manager_id, scheduled_for desc);

alter table public.one_on_ones enable row level security;

-- The subject can always see their own 1:1s. That is the whole point of
-- decision 2 above: no row here is invisible to the person it is about.
create policy "one_on_ones readable by subject, manager, or hr"
  on public.one_on_ones for select
  to authenticated
  using (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  );

-- Scheduling requires actually managing the person (or being HR), and the
-- manager_id must be the caller — you cannot book a meeting in someone
-- else's name.
create policy "one_on_ones insertable by the manager or hr"
  on public.one_on_ones for insert
  to authenticated
  with check (
    manager_id = (select public.current_employee_id())
    and ((select public.manages(employee_id)) or (select public.is_hr()))
  );

-- Completing, cancelling, and note-taking belong to whoever runs the
-- meeting. The employee reads; they don't edit the record.
create policy "one_on_ones updatable by manager or hr"
  on public.one_on_ones for update
  to authenticated
  using ((select public.manages(employee_id)) or (select public.is_hr()))
  with check ((select public.manages(employee_id)) or (select public.is_hr()));

-- The subject gets told a 1:1 was scheduled — a meeting about someone that
-- they only find out about by opening the app is not the goal.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held',
    'task_reassigned', 'intervention_suggested', 'one_on_one_scheduled'
  ));
