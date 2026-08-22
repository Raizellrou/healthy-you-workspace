-- Bug fix, caught during P6 live verification.
--
-- lib/notify.ts#enqueue() runs as whoever triggers the notification (the
-- actor — the person assigning a task, mentioning someone, deciding a PTO
-- request), not as the recipient. work_schedules and notification_prefs
-- are deliberately self-only RLS (0014 — "personal settings, not an
-- org-visible signal"), so enqueue()'s read of the RECIPIENT's schedule
-- and prefs was silently blocked by RLS whenever actor != recipient — the
-- common case for every real notification — and fell back to
-- lib/schedule.ts's DEFAULT_SCHEDULE, discarding whatever the recipient
-- had actually configured on /settings/schedule.
--
-- Reproduced live: Beatriz Haddad added Saturday as a workday and set a
-- 6:00 AM start + a 2:52 PM quiet-hours end. A task Priya Fontaine
-- assigned to her one minute before quiet hours ended still resolved
-- deliver_after to Monday 9:00 AM — the untouched global default, not
-- Beatriz's actual 6:00 AM start or same-day 2:52 PM cutoff.
--
-- Fix: a security definer function, the same pattern as
-- current_employee_id()/is_hr()/manages()/can_see_employee() from
-- 0010_rls_v2.sql — a narrow, purpose-built side door around RLS that
-- returns only the fields lib/schedule.ts#resolveDeliverAfter() needs for
-- one target employee, regardless of who's calling. This does not loosen
-- work_schedules/notification_prefs RLS itself — direct table reads stay
-- self-only; this function is the one sanctioned exception, and it's used
-- only by the notification funnel.

create or replace function public.get_notification_schedule(target_employee_id uuid)
returns table (
  workdays smallint[],
  start_min integer,
  end_min integer,
  quiet_start_min integer,
  quiet_end_min integer,
  batching_mode text,
  muted_kinds text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(ws.workdays, '{1,2,3,4,5}'::smallint[]),
    coalesce(ws.start_min, 540),
    coalesce(ws.end_min, 1080),
    coalesce(ws.quiet_start_min, 1200),
    coalesce(ws.quiet_end_min, 480),
    coalesce(np.batching_mode, 'immediate'),
    coalesce(np.muted_kinds, '{}'::text[])
  from public.employees e
  left join public.work_schedules ws on ws.employee_id = e.id
  left join public.notification_prefs np on np.employee_id = e.id
  where e.id = target_employee_id;
$$;

grant execute on function public.get_notification_schedule(uuid) to authenticated;
