-- P8: workload rebalancer.
--
-- The rebalancer moves a task from an overloaded person to one with
-- headroom and tells both sides why (app/(app)/tasks/actions.ts#applyRebalanceMoves).
-- That's a different situation from a normal reassignment (existing
-- 'task_assigned', which only ever notifies the person gaining a task) —
-- here the person LOSING a task also needs a notification, and reusing
-- 'task_assigned' for that would be a lie. New kind for both directions.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('task_assigned', 'mention', 'pto_decided', 'due_soon', 'message_held', 'task_reassigned'));
