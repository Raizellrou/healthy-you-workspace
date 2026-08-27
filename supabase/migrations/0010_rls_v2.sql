-- RLS v2: employee sees self, manager sees team, HR sees org — enforced
-- with helper functions, not per-policy inline subqueries.
--
-- All four helpers are SECURITY DEFINER. This is not optional: a policy on
-- `employees` that queries `employees` recurses infinitely without it, since
-- the helper's own internal SELECT would otherwise re-trigger RLS on the
-- same table. `set search_path = public` pins name resolution so the
-- function can't be tricked by a search_path change. Execute is revoked
-- from public/anon and granted only to authenticated — these functions are
-- meaningless (and leak nothing) without a session, but there's no reason
-- to expose them beyond signed-in users.

create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.employees where auth_user_id = auth.uid();
$$;

create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = public as $$
  select app_role from public.employees where auth_user_id = auth.uid();
$$;

create or replace function public.is_hr()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'hr', false);
$$;

-- True when the signed-in caller manages the TEAM that `target` belongs to
-- (not "is target's manager" directly — teams have one manager_id, not
-- employees having one manager_id, so this checks target's team's manager).
create or replace function public.manages(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees e
    join public.teams t on t.id = e.team_id
    where e.id = target and t.manager_id = public.current_employee_id()
  );
$$;

create or replace function public.can_see_employee(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select target = public.current_employee_id()
      or public.is_hr()
      or public.manages(target);
$$;

revoke execute on function public.current_employee_id() from public, anon;
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_hr() from public, anon;
revoke execute on function public.manages(uuid) from public, anon;
revoke execute on function public.can_see_employee(uuid) from public, anon;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_hr() to authenticated;
grant execute on function public.manages(uuid) to authenticated;
grant execute on function public.can_see_employee(uuid) to authenticated;

-- --- daily_activity / risk_scores: scope from org-wide to can_see_employee -
--
-- Previously `using (true)` (0002) — every employee could read everyone's
-- burnout signals. Wrapped in `(select ...)` so Postgres evaluates it once
-- per query (an InitPlan) rather than once per row; at 24 people that's
-- invisible, but it's the correct habit regardless of table size.

drop policy if exists "daily_activity readable by any authenticated user" on public.daily_activity;
create policy "daily_activity readable by can_see_employee"
  on public.daily_activity for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

drop policy if exists "risk_scores readable by any authenticated user" on public.risk_scores;
create policy "risk_scores readable by can_see_employee"
  on public.risk_scores for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

-- --- kudos: flagged (HR-triage) rows become HR-only ------------------------
--
-- Previously a single blanket `using (true)` policy (0003) covered every
-- kudos row, flagged or not — meaning every one of the 24 could read every
-- "I'm worried about my colleague" note meant for HR. Ordinary kudos stay
-- org-wide (they're already treated as semi-public praise in the UI); only
-- flagged=true narrows.

drop policy if exists "kudos readable by any authenticated user" on public.kudos;
create policy "kudos readable, flagged restricted to hr"
  on public.kudos for select
  to authenticated
  using (not flagged or (select public.is_hr()));

-- --- boundary_events: recipient can now see what was held for them ---------
--
-- Previously sender-only (0003) — a message held past working hours was
-- invisible to the person it was held FOR, only visible in the sender's own
-- log. The inbox/"held for you" surface (a later phase) needs the
-- recipient's side of this to exist at the RLS level first.

drop policy if exists "users can select their own sent boundary_events" on public.boundary_events;
create policy "sender, recipient, or hr can select boundary_events"
  on public.boundary_events for select
  to authenticated
  using (
    sender_id = (select public.current_employee_id())
    or recipient_id = (select public.current_employee_id())
    or (select public.is_hr())
  );

-- --- employees: close a privilege-escalation gap ---------------------------
--
-- 0002's self-UPDATE policy (`auth.uid() = auth_user_id`) restricts which
-- ROW can be touched, not which COLUMN — with app_role now on this table, an
-- authenticated user could otherwise PATCH their own row's app_role to 'hr'
-- directly through PostgREST. Nothing in the app ever exercised this policy
-- (grep confirms every `.update("employees", ...)` call anywhere in the repo
-- runs on the service-role client in a seed script, never the browser
-- client), so removing it breaks nothing live. Role/team assignment goes
-- through service-role scripts for now; the Teams screen (app/(app)/teams/)
-- is the eventual is_hr()-gated path for this.

drop policy if exists "users can update their own employee row" on public.employees;

-- Replacement: HR can update any employee row (needed for the Teams screen
-- to reassign managers and grant/revoke HR — role/team assignment has no
-- self-service path anymore). `with check` re-verifies the caller is still
-- HR after the write, which is always true here since is_hr() reads the
-- CALLER's own role, not the row being touched. This is deliberately a
-- full-row policy, not column-restricted — HR is a fully trusted admin
-- role in this app's model. Column-level narrowness comes from the Server
-- Actions that call this (app/(app)/teams/actions.ts), which only ever
-- send the specific fields they mean to change, not from RLS.
create policy "hr can update any employee"
  on public.employees for update
  to authenticated
  using ((select public.is_hr()))
  with check ((select public.is_hr()));

-- --- teams -------------------------------------------------------------

alter table public.teams enable row level security;

create policy "teams readable by any authenticated user"
  on public.teams for select
  to authenticated
  using (true);

create policy "hr can manage teams"
  on public.teams for all
  to authenticated
  using ((select public.is_hr()))
  with check ((select public.is_hr()));
