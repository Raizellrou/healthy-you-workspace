-- Fixes a pre-existing bug found while verifying 0032: boundary_events_action_check
-- (added in 0008) only allowed 'delivered', 'delayed', 'warned_sent_anyway',
-- 'blocked_until_return' — but lib/boundary-v2.ts (the evaluation engine
-- actually in use) writes the short names 'blocked' and 'warned', which
-- match neither of those two. 'warned_sent_anyway'/'blocked_until_return'
-- are dead values, never written anywhere in the app (verified by grep).
--
-- Net effect until now: any message that evaluates to "blocked" or "warned"
-- has been failing to insert into boundary_events at all, surfacing to the
-- sender as a generic "That value isn't allowed" error instead of actually
-- recording the block/warning. This also blocked 0032's new 'cancelled'
-- value, which is what surfaced the bug.

alter table public.boundary_events
  drop constraint boundary_events_action_check;

alter table public.boundary_events
  add constraint boundary_events_action_check check (action in (
    'delivered', 'delayed', 'blocked', 'warned', 'cancelled'
  ));
