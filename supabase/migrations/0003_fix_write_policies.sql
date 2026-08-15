-- The pre-existing RLS policies on mood_checkins, kudos, and boundary_events
-- compare auth.uid() directly against employee_id, but employee_id refers to
-- employees.id, not auth.users.id — those are linked via employees.auth_user_id,
-- not equal. That mismatch makes every insert fail RLS even for the owner.
-- This drops whatever policies currently exist on these 3 tables (by name,
-- dynamically, since we don't know what they're called) and replaces them
-- with policies that actually match our auth model.

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('mood_checkins', 'kudos', 'boundary_events')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- mood_checkins: insert-as-self only, select-own-only (never cross-user —
-- this is the one place the app's privacy promise has to be a real
-- constraint, not just a UI omission). One check-in per employee per day,
-- enforced at the DB level.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mood_checkins_employee_date_unique'
  ) then
    alter table public.mood_checkins
      add constraint mood_checkins_employee_date_unique unique (employee_id, date);
  end if;
end $$;

create policy "users can insert their own mood_checkins"
  on public.mood_checkins for insert
  to authenticated
  with check (
    employee_id in (select id from public.employees where auth_user_id = auth.uid())
  );

create policy "users can select their own mood_checkins"
  on public.mood_checkins for select
  to authenticated
  using (
    employee_id in (select id from public.employees where auth_user_id = auth.uid())
  );

-- Team/day aggregates are the only way to see mood data beyond your own
-- check-ins — a SECURITY DEFINER function that never returns individual
-- rows, and hides the result entirely if fewer than 3 people checked in
-- (so a 1-2 person team can't be de-anonymized).
create or replace function public.get_team_mood_aggregate(
  target_team text,
  target_date date default current_date
)
returns table (avg_mood numeric, checkin_count integer)
language sql
security definer
set search_path = public
as $$
  select
    case when count(*) >= 3 then round(avg(mc.mood_value), 1) else null end as avg_mood,
    count(*)::integer as checkin_count
  from mood_checkins mc
  join employees e on e.id = mc.employee_id
  where e.team = target_team and mc.date = target_date;
$$;

grant execute on function public.get_team_mood_aggregate(text, date) to authenticated;

-- kudos: insert-as-sender only, readable by anyone authenticated (kudos are
-- already treated as semi-public praise in the UI).
create policy "users can insert kudos as themselves"
  on public.kudos for insert
  to authenticated
  with check (
    from_employee_id in (select id from public.employees where auth_user_id = auth.uid())
  );

create policy "kudos readable by any authenticated user"
  on public.kudos for select
  to authenticated
  using (true);

-- boundary_events: insert-as-sender only, readable by the sender only
-- (this is a personal "recent activity" log of what you sent, not an
-- org-wide feed).
create policy "users can insert boundary_events as themselves"
  on public.boundary_events for insert
  to authenticated
  with check (
    sender_id in (select id from public.employees where auth_user_id = auth.uid())
  );

create policy "users can select their own sent boundary_events"
  on public.boundary_events for select
  to authenticated
  using (
    sender_id in (select id from public.employees where auth_user_id = auth.uid())
  );
