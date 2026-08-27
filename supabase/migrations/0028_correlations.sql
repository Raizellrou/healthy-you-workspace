-- P9: two HR-only correlation stats for /insights, backing the burnout
-- forecast card's "is this actually a pattern, or just this person" side.
--
-- Both use daily_activity (0008) — meeting_hours and off_hours_messages,
-- a real 1200-row-and-growing per-employee-per-day log — joined with
-- mood_checkins where needed. risk_scores (0008) was considered and
-- rejected: it holds one current snapshot per employee (24 rows total,
-- one per person, no history), so there's nothing to correlate a "days"
-- window against. compositeV2 itself (lib/burnout-signals.ts) is
-- deliberately NOT re-derived here — its weights already live in
-- lib/burnout.ts and lib/burnout-signals.ts, and duplicating that scoring
-- logic in SQL is exactly the two-places-computing-the-same-thing drift
-- this codebase's own comments warn against elsewhere (buildBurnoutV2's
-- docstring, for one). Real, independently-measured signals instead:
-- meeting load vs. off-hours activity, and off-hours activity vs.
-- self-reported mood — both genuine burnout-adjacent questions answerable
-- straight from stored data.
--
-- Postgres's built-in corr() aggregate (population Pearson correlation
-- coefficient) does the actual math — no hand-rolled formula to get wrong.
--
-- Follows get_notification_hold_rate's (0020) shape: `where public.is_hr()`
-- filters a non-HR caller to zero rows rather than raising, so the UI's
-- HR gate and this function can't disagree in a way that throws.

create or replace function public.get_meeting_burnout_corr(days integer default 30)
returns table (
  correlation double precision,
  sample_size bigint,
  avg_meeting_hours numeric,
  avg_off_hours_messages numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    corr(meeting_hours, off_hours_messages::double precision),
    count(*),
    round(avg(meeting_hours)::numeric, 2),
    round(avg(off_hours_messages)::numeric, 2)
  from public.daily_activity
  where public.is_hr()
    and date >= current_date - days;
$$;

create or replace function public.get_offhours_mood_corr(days integer default 30)
returns table (
  correlation double precision,
  sample_size bigint,
  avg_off_hours_messages numeric,
  avg_mood numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    corr(a.off_hours_messages::double precision, m.mood_value::double precision),
    count(*),
    round(avg(a.off_hours_messages)::numeric, 2),
    round(avg(m.mood_value)::numeric, 2)
  from public.daily_activity a
  join public.mood_checkins m on m.employee_id = a.employee_id and m.date = a.date
  where public.is_hr()
    and a.date >= current_date - days;
$$;

revoke execute on function public.get_meeting_burnout_corr(integer) from public, anon;
revoke execute on function public.get_offhours_mood_corr(integer) from public, anon;
grant execute on function public.get_meeting_burnout_corr(integer) to authenticated;
grant execute on function public.get_offhours_mood_corr(integer) to authenticated;
