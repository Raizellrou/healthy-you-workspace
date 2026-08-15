-- Links the existing employees table to real Supabase Auth users.
-- Existing employees.id stays the stable business-data key; auth_user_id
-- is populated by scripts/seed.ts after creating each auth user.

alter table public.employees
  add column if not exists auth_user_id uuid unique references auth.users (id);
