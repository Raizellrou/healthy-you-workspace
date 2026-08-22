-- Baseline schema for the 8 tables that predate this migrations directory.
--
-- employees, daily_activity, risk_scores, nudge_events, nudge_preferences,
-- mood_checkins, kudos, and boundary_events were created by hand in the
-- Supabase dashboard before this project had a migrations/ folder at all.
-- Migrations 0001-0007 all assume these tables already exist (0001 ALTERs
-- employees, 0002 enables RLS on 5 of them, etc.) — none of them contain a
-- single CREATE TABLE. Losing the hosted project would mean losing this
-- schema entirely, with nothing in source control to rebuild it from.
--
-- Column definitions below come from scripts/introspect-schema.ts, run
-- against the live project, not from inference over the TypeScript layer —
-- three of these tables (risk_scores, nudge_events, nudge_preferences) have
-- no application code referencing them at all, so there was no other way
-- to know their real shape.
--
-- INTENTIONALLY OUT OF ORDER: despite being numbered last, this must be the
-- FIRST migration applied to an empty database. 0001 runs an ALTER TABLE
-- against employees that requires the table to already exist; 0002 enables
-- RLS on tables this file creates. On the live project every one of these
-- tables already exists, so every statement here is a no-op there — that's
-- what makes it safe to run out of numeric order against prod.
--
-- Deliberately NOT included, by design:
--   - auth_user_id on employees, and its UNIQUE constraint — 0001 adds both.
--   - kudos.flagged — 0004 adds it.
--   - The kudos_type CHECK content — 0005 owns the authoritative version
--     and already drops-and-recreates it, so this file doesn't need to guess
--     at it.
--   - RLS policies and RLS enablement — 0002/0003 own that, and enabling it
--     here too would just be redundant with what they already do.
--   - Indexes — every index found on these 8 tables in the live project
--     turned out to back a PK or UNIQUE constraint already declared here;
--     there were no hand-added performance indexes to reproduce.
--   - concern_flags, focus_sessions — two more undocumented tables were
--     discovered during introspection, but neither has any RLS policy in
--     the live project. That's a separate problem (concern_flags is meant
--     to carry anonymous reports to HR — no RLS on it is a live exposure,
--     not a schema gap) and belongs in its own migration once that's
--     designed, not folded quietly into a "just capture the DDL" pass.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null,
  role text,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  date date not null,
  meeting_hours numeric default 0,
  available_hours numeric default 8,
  off_hours_messages integer default 0,
  worked_today boolean default true,
  on_pto boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  computed_date date not null,
  streak_score numeric,
  meeting_score numeric,
  off_hours_score numeric,
  pto_score numeric,
  composite_score numeric,
  band text,
  created_at timestamptz default now()
);

create table if not exists public.nudge_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  nudge_type text,
  triggered_at timestamptz default now(),
  acknowledged boolean default false,
  snoozed_until timestamptz
);

create table if not exists public.nudge_preferences (
  employee_id uuid primary key references public.employees(id),
  quiet_hours_start time default '18:00:00',
  quiet_hours_end time default '08:00:00',
  max_nudges_per_day integer default 6
);

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  date date not null,
  mood_value integer,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  from_employee_id uuid references public.employees(id),
  to_employee_id uuid references public.employees(id),
  kudos_type text,
  message text,
  created_at timestamptz default now()
);

create table if not exists public.boundary_events (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.employees(id),
  recipient_id uuid references public.employees(id),
  channel text,
  message_preview text,
  sent_at timestamptz default now(),
  action text,
  scheduled_delivery timestamptz
);

-- --- Constraints with no migration anywhere else ---------------------------
--
-- Each of these exists in the live project today but is not created by any
-- file in this directory, so 0008 is the only place that can capture it.
-- Guarded with exception handling (not "if not exists", which ALTER TABLE
-- ADD CONSTRAINT doesn't support) so this stays a true no-op against prod.
-- A duplicate UNIQUE constraint raises duplicate_table (its backing index
-- collides), while a duplicate CHECK raises duplicate_object — catching
-- both keeps every block below correct regardless of which kind it is.

do $$ begin
  alter table public.daily_activity
    add constraint daily_activity_employee_id_date_key unique (employee_id, date);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.mood_checkins
    add constraint mood_checkins_mood_value_check check (mood_value between 1 and 5);
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.boundary_events
    add constraint boundary_events_action_check check (action in (
      'delivered', 'delayed', 'warned_sent_anyway', 'blocked_until_return'
    ));
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.nudge_events
    add constraint nudge_events_nudge_type_check check (nudge_type in (
      'stretch', 'hydrate', 'eye_rest', 'posture'
    ));
exception when duplicate_object or duplicate_table then null;
end $$;

do $$ begin
  alter table public.risk_scores
    add constraint risk_scores_employee_id_computed_date_key unique (employee_id, computed_date);
exception when duplicate_object or duplicate_table then null;
end $$;

-- --- mood_checkins uniqueness, defensively duplicated ----------------------
--
-- 0003 already adds this constraint (guarded by a pg_constraint existence
-- check rather than exception handling). It's repeated here, in this file's
-- own idiom, so a fresh database is correct even if 0008 were ever the only
-- migration run — the "one check-in per employee per day" rule is this
-- schema's actual privacy boundary and shouldn't depend on run order.

do $$ begin
  alter table public.mood_checkins
    add constraint mood_checkins_employee_date_unique unique (employee_id, date);
exception when duplicate_object or duplicate_table then null;
end $$;

-- --- Introspection helpers for scripts/verify-schema.ts --------------------
--
-- information_schema.columns, pg_constraint, and pg_policies aren't exposed
-- through PostgREST's table API — only ordinary tables/views are — so the
-- verification script goes through these three SECURITY DEFINER functions
-- instead. `create or replace` makes re-running this section harmless.

create or replace function public._verify_columns()
returns table (table_name text, column_name text, data_type text)
language sql security definer set search_path = public as $$
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public';
$$;

create or replace function public._verify_constraints()
returns table (conrelid text, conname text)
language sql security definer set search_path = public as $$
  select c.conrelid::regclass::text, c.conname
  from pg_constraint c
  where c.connamespace = 'public'::regnamespace;
$$;

create or replace function public._verify_rls()
returns table (relname text, relrowsecurity boolean)
language sql security definer set search_path = public as $$
  select cl.relname, cl.relrowsecurity
  from pg_class cl
  join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public' and cl.relkind = 'r';
$$;

grant execute on function public._verify_columns() to service_role;
grant execute on function public._verify_constraints() to service_role;
grant execute on function public._verify_rls() to service_role;
