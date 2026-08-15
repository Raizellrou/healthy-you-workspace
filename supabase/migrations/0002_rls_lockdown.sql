-- Locks down the 5 tables that currently have no RLS at all
-- (employees, daily_activity, risk_scores, nudge_events, nudge_preferences).
-- Nothing in the app talks to this database yet, so this is a no-risk fix.

-- employees: org-wide read (Directory needs to list everyone),
-- self-update only.
alter table public.employees enable row level security;

create policy "employees readable by any authenticated user"
  on public.employees for select
  to authenticated
  using (true);

create policy "users can update their own employee row"
  on public.employees for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

-- daily_activity / risk_scores: org-wide read (Burnout Risk needs
-- everyone's numbers), no client writes — these are populated by a
-- trusted backend process (service role bypasses RLS), not end users.
alter table public.daily_activity enable row level security;

create policy "daily_activity readable by any authenticated user"
  on public.daily_activity for select
  to authenticated
  using (true);

alter table public.risk_scores enable row level security;

create policy "risk_scores readable by any authenticated user"
  on public.risk_scores for select
  to authenticated
  using (true);

-- nudge_events / nudge_preferences: not read by the app yet (Nudges stays
-- a client-only simulation for now), but locked to "own record only" as a
-- safe default in case real nudge tracking is built later.
alter table public.nudge_events enable row level security;

create policy "users can manage their own nudge_events"
  on public.nudge_events for all
  to authenticated
  using (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  );

alter table public.nudge_preferences enable row level security;

create policy "users can manage their own nudge_preferences"
  on public.nudge_preferences for all
  to authenticated
  using (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  )
  with check (
    employee_id in (
      select id from public.employees where auth_user_id = auth.uid()
    )
  );
