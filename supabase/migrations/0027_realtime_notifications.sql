-- P9: live inbox badge, notifications only.
--
-- 0014 deliberately skipped realtime, calling it "a one-line, purely
-- additive change to make later if a live-updating badge turns out to be
-- worth the added client-side subscription code." That's now: lib/realtime.ts
-- subscribes to this table, filtered recipient_id=eq.{me} — RLS already
-- restricts SELECT to current_employee_id(), so no new policy is needed for
-- the subscription to be safe. The client still gates on deliver_after
-- itself (quiet hours must not surface early just because realtime is fast),
-- so no behavior changes here beyond "the row exists for a channel to see."
alter publication supabase_realtime add table public.notifications;

-- Pre-existing bug, unrelated to realtime: 0018's kind check never picked up
-- three kinds lib/notify.ts has emitted since P8 (intervention_suggested,
-- one_on_one_scheduled, coffee_proposed). Every enqueue() call using one of
-- those has been failing its insert. Fixing here since this migration
-- already touches the table.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held',
    'task_reassigned', 'intervention_suggested', 'one_on_one_scheduled', 'coffee_proposed'
  ));
