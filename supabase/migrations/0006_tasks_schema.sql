-- New Tasks pillar: Asana-style projects/boards/tasks. All 5 tables are
-- select-all-authenticated in the follow-up RLS migration (0007) — this app
-- has no multi-tenant boundary, and every other non-mood table already
-- follows that same trust model.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#0ea5e9',
  created_at timestamptz not null default now()
);

create table public.board_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  position integer not null default 0
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_id uuid references public.board_sections(id) on delete set null,
  title text not null,
  description text,
  assignee_id uuid references public.employees(id) on delete set null,
  created_by uuid not null references public.employees(id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position integer not null default 0
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.employees(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_assignee_id_idx on public.tasks(assignee_id);
create index board_sections_project_id_idx on public.board_sections(project_id);
create index subtasks_task_id_idx on public.subtasks(task_id);
create index task_comments_task_id_idx on public.task_comments(task_id);
