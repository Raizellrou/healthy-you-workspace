-- Cancel a held boundary message (audit H5). boundary_events had insert
-- and select policies (0003, 0010) but no update policy at all, so
-- cancelBoundaryMessage's UPDATE would silently affect zero rows without
-- this. Scoped to the sender's own still-"delayed" messages — matches the
-- action's own `.eq("action", "delayed")` guard, so an already-delivered
-- message can't be cancelled even if the guard were bypassed client-side.
--
-- No CHECK constraint exists on boundary_events.action (verified against
-- every migration that touches this table), so "cancelled" needs no schema
-- change beyond this policy.

create policy "sender can cancel their own delayed boundary_events"
  on public.boundary_events for update
  to authenticated
  using (sender_id = (select public.current_employee_id()) and action = 'delayed')
  with check (sender_id = (select public.current_employee_id()));
