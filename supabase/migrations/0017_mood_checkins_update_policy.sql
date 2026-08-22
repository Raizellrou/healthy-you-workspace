-- Bug fix, caught during P7 live verification.
--
-- mood_checkins has only ever had INSERT and SELECT policies
-- (0003_fix_write_policies.sql — "insert-as-self only, select-own-only").
-- Nobody needed to update a check-in after submitting it until this phase's
-- optional energy/note add-on (app/(app)/mood/actions.ts#updateMoodDetails).
-- With no UPDATE policy, that action's `.update()` call silently affected
-- zero rows — no error, since RLS filters matching rows rather than
-- throwing, so it looked like it worked. Reproduced live: picked a mood,
-- added an energy level and a note, got no error, but the row's energy/
-- note stayed null.

create policy "users can update their own mood_checkins"
  on public.mood_checkins for update
  to authenticated
  using (employee_id = (select public.current_employee_id()))
  with check (employee_id = (select public.current_employee_id()));
