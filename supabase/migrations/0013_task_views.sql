-- P5: saved views for the List/Board/Calendar/Timeline switcher. Filter
-- state itself lives in the URL's searchParams (see lib/tasks.ts#filterTasks
-- and app/(app)/tasks/project/[projectId]/[view]/page.tsx) — a "saved view"
-- is just a name pointing at one of those querystrings, so loading one is a
-- plain navigation, not a client-state restore.

create table public.task_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.employees(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  layout text not null check (layout in ('list', 'board', 'calendar', 'timeline')),
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index task_views_project_id_idx on public.task_views(project_id);
create index task_views_owner_id_idx on public.task_views(owner_id);

alter table public.task_views enable row level security;

-- Same shared-vs-private shape as kudos.flagged (0004/0010): everyone sees
-- their own, plus anyone else's marked shared. No UPDATE policy — a saved
-- view is created or deleted, never edited in place, so there's nothing to
-- write-scope there yet.
create policy "task_views readable by owner or when shared"
  on public.task_views for select
  to authenticated
  using (
    owner_id = (select public.current_employee_id())
    or is_shared
  );

create policy "task_views insertable by self"
  on public.task_views for insert
  to authenticated
  with check (owner_id = (select public.current_employee_id()));

create policy "task_views deletable by owner"
  on public.task_views for delete
  to authenticated
  using (owner_id = (select public.current_employee_id()));
