-- Run in Supabase SQL Editor, paste the result back.
select 'INDEX' as kind, tablename as rel, indexdef as body
from pg_indexes
where schemaname = 'public'
union all
select 'POLICY', tablename,
       policyname || ' | ' || cmd || ' | roles=' || array_to_string(roles, ',') ||
       ' | using=' || coalesce(qual, '-') ||
       ' | check=' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public'
union all
select 'CONSTRAINT', conrelid::regclass::text, conname || ' | ' || pg_get_constraintdef(oid)
from pg_constraint
where connamespace = 'public'::regnamespace and contype in ('c', 'u', 'x')
union all
select 'TRIGGER', tgrelid::regclass::text, tgname || ' | ' || pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid::regclass::text not like 'pg_%'
union all
select 'FUNCTION', 'public', p.proname || ' | ' || pg_get_function_identity_arguments(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by 1, 2, 3;
