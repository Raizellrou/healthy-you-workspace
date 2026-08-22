-- Adds a real `teams` table and an application-level role to `employees`,
-- so "employee sees self, manager sees team, HR sees org" can be enforced
-- in Postgres (0010) instead of every screen trusting the client.
--
-- Two columns this deliberately does NOT touch:
--   - employees.role — a job-title string ("Software Engineer", "Design
--     Lead"), selected by name in the frozen lib/supabase/queries.ts. This
--     migration adds app_role as a separate column rather than repurposing
--     or renaming this one.
--   - employees.team (text) — stays exactly as-is and keeps being written
--     to by nothing (it's now a mirror, see the trigger below), so the
--     frozen query layer's `select("... team ...")` and
--     get_team_mood_aggregate's `e.team = target_team` join keep working
--     unmodified. employees.team_id becomes the real foreign key;
--     employees.team stays in sync with it automatically.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manager_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists teams_manager_id_idx on public.teams(manager_id);

alter table public.employees
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists app_role text not null default 'employee'
    check (app_role in ('employee', 'manager', 'hr')),
  add column if not exists timezone text not null default 'Asia/Manila',
  add column if not exists weekly_capacity_hours numeric(4,1) not null default 40;
create index if not exists employees_team_id_idx on public.employees(team_id);

-- Mirrors teams.name into employees.team whenever team_id changes, so the
-- frozen query layer's text column stays correct without being touched.
-- One direction only: team_id drives team, never the reverse — updating
-- the text column directly (nothing in the app does, or should) has no
-- effect on team_id.
create or replace function public.employees_sync_team_name()
returns trigger
language plpgsql
as $$
begin
  -- OLD isn't bound on INSERT — TG_OP short-circuits the OR so `old.team_id`
  -- is never evaluated in that branch. Every insert reaches this trigger
  -- regardless of the "OF team_id" qualifier below (that clause only
  -- narrows which UPDATEs fire it, not whether INSERT does). Skipped
  -- entirely when team_id is null, so a row inserted without one keeps
  -- whatever `team` text it was given instead of being nulled out — `team`
  -- is NOT NULL, and a `select into` that matches zero rows sets its target
  -- to null rather than erroring.
  if new.team_id is not null
     and (TG_OP = 'INSERT' or new.team_id is distinct from old.team_id) then
    select name into new.team from public.teams where id = new.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_sync_team_name_trigger on public.employees;
create trigger employees_sync_team_name_trigger
  before insert or update of team_id on public.employees
  for each row
  execute function public.employees_sync_team_name();

-- --- Backfill: the 4 teams already implied by employees.team ---------------
--
-- This project's org has always had exactly these 4 (see AGENTS.md, every
-- pillar screen's team filter). Insert them, then point every existing
-- employee's team_id at the matching row by name — the trigger above only
-- fires on team_id changes, so this UPDATE both sets team_id and leaves
-- employees.team exactly as it already was (matching, since that's what
-- it's matched against).

insert into public.teams (name)
values ('Engineering'), ('Design'), ('Sales'), ('Support')
on conflict (name) do nothing;

update public.employees e
set team_id = t.id
from public.teams t
where t.name = e.team
  and e.team_id is null;

-- --- Demo role assignment ---------------------------------------------------
--
-- Manager pick per team: prefer whoever's job title (employees.role, the
-- untouched text column) contains "Manager" or "Lead", tie-broken
-- alphabetically; fall back to the alphabetically-first team member if no
-- title matches. This is a rule, not a guess — Engineering has 3 people
-- titled "Engineering Manager" today, Design has none, so a rule that's
-- explicit and rerunnable beats a one-off hand pick. Adjust anytime through
-- the Teams screen (app/(app)/teams/) once P2 ships it, or by editing
-- teams.manager_id / employees.app_role directly.
--
-- HR: nobody in this org has an HR-flavored job title (there's no HR team —
-- see AGENTS.md's 4 pillar teams), so this one really is a manual pick,
-- called out separately from the rule above. Priya Fontaine's title
-- ("Success Manager") is the closest thing to a people-facing role among
-- the 24; changing who holds app_role = 'hr' is a one-row UPDATE.
--
-- `where t.manager_id is null` below is what makes this block safe to run
-- more than once: it only ever sets an INITIAL manager, so a real
-- reassignment made later through the Teams screen survives a re-paste of
-- this file rather than being silently recomputed back to the default.

with ranked as (
  select
    e.id, e.name, e.team_id,
    row_number() over (
      partition by e.team_id
      order by
        case when e.role ilike '%manager%' or e.role ilike '%lead%' then 0 else 1 end,
        e.name
    ) as rnk
  from public.employees e
  where e.team_id is not null
)
update public.teams t
set manager_id = ranked.id
from ranked
where ranked.team_id = t.id and ranked.rnk = 1 and t.manager_id is null;

update public.employees
set app_role = 'manager'
where id in (select manager_id from public.teams where manager_id is not null);

update public.employees
set app_role = 'hr'
where name = 'Priya Fontaine';
