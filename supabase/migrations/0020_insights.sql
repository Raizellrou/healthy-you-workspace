-- P8 item 4: HR org analytics (/insights).
--
-- Almost every metric on that screen reads through existing RLS, which
-- already gives HR the org-wide scope it needs:
--   burnout signals  -> can_see_employee() (0010)
--   pto_requests     -> can_see_employee() (0012)
--   kudos            -> org-readable (0010)
--   task_events      -> org-readable (0011)
--   mood             -> get_org_mood_trend() (0016, n>=3 gated)
--   boundary         -> get_boundary_offhours_rate() (0016, HR-only)
--
-- `notifications` is the one exception: it's recipient-only by design
-- (0014 — "notifications readable by recipient"), so an HR aggregate over
-- everyone's inbox is silently filtered to just their own rows. That's the
-- same actor-isn't-the-subject trap 0015 fixed for get_notification_schedule,
-- and it gets the same narrow security-definer side door rather than a
-- loosened table policy: this returns counts only, never a title, body, or
-- recipient, so "how often is the boundary machinery actually holding
-- things?" is answerable without exposing anyone's inbox contents.
--
-- Follows get_boundary_offhours_rate's shape: `where public.is_hr()`
-- filters a non-HR caller to zero rows rather than raising, so the UI's
-- HR gate and this function can't disagree in a way that throws.

create or replace function public.get_notification_hold_rate(days integer default 30)
returns table (held_reason text, notification_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(n.held_reason, 'delivered') as held_reason,
    count(*) as notification_count
  from public.notifications n
  where public.is_hr()
    and n.created_at >= now() - (days || ' days')::interval
  group by coalesce(n.held_reason, 'delivered')
  order by 1;
$$;

revoke execute on function public.get_notification_hold_rate(integer) from public, anon;
grant execute on function public.get_notification_hold_rate(integer) to authenticated;
