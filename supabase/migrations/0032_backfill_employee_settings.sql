-- Fix: "Petal HR" (0031_hr_demo_account.sql) was inserted directly into
-- employees, bypassing 0014_notifications_and_schedules.sql's one-time
-- backfill of work_schedules/notification_prefs — that backfill only ever
-- ran against the 24 employees that existed at the time. The result:
-- lib/supabase/notifications.ts#getMySettings does `.single()` against
-- work_schedules for the new employee, gets zero rows, and PostgREST
-- returns "Cannot coerce the result to a single JSON object" — the error
-- behind Settings > Schedule's error boundary (reference 230228564).
--
-- Two parts: backfill the rows missing right now (covers Petal HR and any
-- other gap), then a trigger so this can't recur for the next employee
-- added outside the seed flow — restores the invariant 0014's own comment
-- states ("the app never has to handle a missing schedule/prefs row as a
-- special case") instead of special-casing this one account.

insert into public.work_schedules (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

insert into public.notification_prefs (employee_id)
select id from public.employees
on conflict (employee_id) do nothing;

create or replace function public.employees_ensure_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.work_schedules (employee_id) values (new.id)
  on conflict (employee_id) do nothing;
  insert into public.notification_prefs (employee_id) values (new.id)
  on conflict (employee_id) do nothing;
  return new;
end;
$$;

create trigger employees_ensure_settings_trigger
  after insert on public.employees
  for each row
  execute function public.employees_ensure_settings();
