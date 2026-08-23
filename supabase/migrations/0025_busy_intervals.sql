-- Free/busy lookup for coffee scheduling.
--
-- THE BUG THIS FIXES, caught live: app/(app)/kudos/actions.ts#proposeCoffee
-- claims to pick "the first 30 minutes you're both free", but it read
-- calendar_events through the caller's own client. calendar_events SELECT
-- is can_see_employee() (0022) — correct, a calendar is not org-readable —
-- so a plain employee proposing a coffee could see only THEIR OWN
-- meetings. The invitee's calendar came back empty and the finder happily
-- proposed a slot the other person was already booked in. Reproduced with
-- two overlapping meetings: it returned 11:00, the end of the proposer's
-- meeting, straight through the middle of the invitee's.
--
-- This is the third appearance of the same shape: the actor is not the
-- subject, so the actor's RLS scope is the wrong scope for the question.
-- 0015 hit it for notification schedules, 0016 for recipient availability.
-- Same remedy each time — a narrow security-definer function rather than a
-- loosened table policy.
--
-- WHAT THIS DELIBERATELY DOES NOT RETURN: title, kind, attendee_count,
-- series, or organiser. Only start and end instants. That is the whole
-- point — finding a mutual gap needs to know THAT someone is busy, never
-- what they are doing. Anyone who can already see the calendar properly
-- gets the details through the table; this function exists so that
-- scheduling does not require that access.

create or replace function public.get_busy_intervals(
  target_employee_id uuid,
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select e.starts_at, e.ends_at
  from public.calendar_events e
  where e.employee_id = target_employee_id
    and e.starts_at >= from_ts
    and e.starts_at < to_ts
  order by e.starts_at;
$$;

revoke execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_busy_intervals(uuid, timestamptz, timestamptz) to authenticated;
