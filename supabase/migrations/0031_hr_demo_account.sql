-- Adds a dedicated demo account for testing HR-level access, distinct from
-- the 24 real employee personas. The existing app_role = 'hr' account
-- (Priya Fontaine, see 0009_teams_and_roles.sql) is a repurposed employee
-- persona, picked because "nobody in this org has an HR-flavored job
-- title" — fine for seeding a manager, but indistinguishable from a regular
-- employee in the login quick-pick list. This adds an account named for the
-- role instead of a person, so it reads unambiguously as the HR login.
--
-- team is 'People' (not one of the 4 operational teams) so this account
-- doesn't inflate Engineering/Design/Sales/Support headcounts or skew their
-- workload/burnout aggregates. team_id is left null, which the sync trigger
-- from 0009_teams_and_roles.sql explicitly leaves alone in that case. No
-- daily_activity/tasks/etc. rows are seeded for this account, so every
-- derived metric (burnout, workload) falls back to this project's existing
-- empty-state defaults (see EMPTY_STATS in lib/supabase/queries.ts).

insert into public.employees (name, team, role, email, app_role)
select 'Petal HR', 'People', 'HR Administrator', 'petal.hr@petal.test', 'hr'
where not exists (
  select 1 from public.employees where email = 'petal.hr@petal.test'
);
