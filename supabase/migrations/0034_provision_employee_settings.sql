-- Provisions work_schedules + notification_prefs for every new employee.
--
-- 0014 created both tables and backfilled a row for every employee that
-- existed at that moment, with the comment "Backfilled for every employee in
-- this same migration, so the app never has to handle a missing
-- schedule/prefs row as a special case." That was true on the day it ran and
-- silently stopped being true the first time anyone was onboarded: nothing
-- provisioned rows for employees created afterwards.
--
-- The consequence was not subtle. getMySettings() in
-- lib/supabase/notifications.ts read both tables with .single(), which throws
-- on zero rows, so /dashboard and /settings/schedule both hit the route error
-- boundary for any employee created after 0014 — the first screen a new hire
-- ever sees, with a "Back to dashboard" button that led straight back into
-- it. Found by signing in as the three qa-*@petal.test accounts, which
-- scripts/seed-role-accounts.ts created long after 0014.
--
-- Fixed in two places on purpose. getMySettings now falls back to the same
-- defaults this file declares (so the app cannot crash even if this trigger
-- is ever dropped), and this migration keeps the data itself correct (so code
-- paths that read the tables directly still see a row).
--
-- Step order below matters: configured_at is backfilled for the employees
-- that already had rows BEFORE the missing rows are created, so the people
-- onboarded since 0014 come out with a null configured_at and get the
-- first-run prompt, while everyone else does not.

-- --- 1. First-run tracking -------------------------------------------------
--
-- Once every employee is guaranteed a row, "has a row" can no longer mean
-- "has set their hours": the trigger below hands everyone the 09:00-18:00
-- Mon-Fri defaults whether they asked for them or not, and nothing on screen
-- says so. Comparing against the default values can't distinguish "never
-- configured" from "genuinely works 9 to 6", so the intent is recorded
-- explicitly. Null means never configured; updateWorkSchedule in
-- app/(app)/settings/actions.ts stamps it on first save.

alter table public.work_schedules
  add column if not exists configured_at timestamptz;

-- Everyone who already had a row has been using the app with these settings,
-- so they are treated as configured rather than newly prompted.
update public.work_schedules
  set configured_at = now()
  where configured_at is null;

-- --- 2. Trigger ------------------------------------------------------------
--
-- security definer is required, not decorative: 0014 gave both tables SELECT
-- and UPDATE policies scoped to the employee themselves and *no INSERT policy
-- at all*. An invoker-rights trigger would therefore be denied by RLS for any
-- caller except the service role — including the app itself, if an admin
-- create-employee flow is ever added. Same
-- `security definer set search_path = public` shape as can_see_employee() and
-- friends in 0008/0010.

create or replace function public.employees_provision_settings()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.work_schedules (employee_id)
  values (new.id)
  on conflict (employee_id) do nothing;

  insert into public.notification_prefs (employee_id)
  values (new.id)
  on conflict (employee_id) do nothing;

  return new;
end;
$$;

drop trigger if exists employees_provision_settings_trigger on public.employees;
create trigger employees_provision_settings_trigger
  after insert on public.employees
  for each row
  execute function public.employees_provision_settings();

-- --- 3. Backfill -----------------------------------------------------------
--
-- Same shape as 0014's original backfill. Covers everyone created between
-- 0014 and now — the three QA role accounts at minimum, plus any employee
-- added by hand in the SQL editor since. These rows keep configured_at null
-- (step 1 ran before they existed), which is correct: nobody has ever set
-- their hours.

insert into public.work_schedules (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

insert into public.notification_prefs (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;
