-- RLS for the Tasks pillar. Read access mirrors kudos/directory
-- (select-all-authenticated — this is a single 24-person org, not a
-- multi-tenant product, so no per-project membership gate). Writes are
-- restricted to "as yourself" where the row has a clear owner
-- (created_by/author_id); everything else (updates, subtask/section/project
-- edits) is open to any authenticated user, matching the shared-board
-- reality of a Kanban tool — reassigning, checking off, and dragging cards
-- between columns are things any teammate on the board legitimately does.

alter table public.projects enable row level security;
alter table public.board_sections enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_comments enable row level security;

create policy "projects readable by authenticated"
  on public.projects for select to authenticated using (true);
create policy "projects modifiable by authenticated"
  on public.projects for all to authenticated using (true) with check (true);

create policy "board_sections readable by authenticated"
  on public.board_sections for select to authenticated using (true);
create policy "board_sections modifiable by authenticated"
  on public.board_sections for all to authenticated using (true) with check (true);

create policy "tasks readable by authenticated"
  on public.tasks for select to authenticated using (true);
create policy "users can insert tasks as themselves"
  on public.tasks for insert to authenticated with check (
    created_by in (select id from public.employees where auth_user_id = auth.uid())
  );
create policy "tasks updatable by authenticated"
  on public.tasks for update to authenticated using (true) with check (true);
create policy "tasks deletable by authenticated"
  on public.tasks for delete to authenticated using (true);

create policy "subtasks readable by authenticated"
  on public.subtasks for select to authenticated using (true);
create policy "subtasks modifiable by authenticated"
  on public.subtasks for all to authenticated using (true) with check (true);

create policy "task_comments readable by authenticated"
  on public.task_comments for select to authenticated using (true);
create policy "users can insert comments as themselves"
  on public.task_comments for insert to authenticated with check (
    author_id in (select id from public.employees where auth_user_id = auth.uid())
  );
