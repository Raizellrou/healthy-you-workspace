-- Tightens the two write paths 0007_tasks_rls.sql left fully open: project
-- create/delete and task delete. 0007's "projects modifiable by
-- authenticated" was `for all using (true) with check (true)` — anyone
-- could create or delete a project, and "tasks deletable by authenticated"
-- let anyone delete any task. The app now self-checks role in
-- createProject/deleteProject/deleteTask (app/(app)/tasks/actions.ts,
-- lib/authz.ts#canManageProjects), but a Server Action self-check alone is
-- bypassable by any direct PostgREST call, so this migration makes RLS the
-- actual enforcement, matching every other write path in this schema.
--
-- Project UPDATE and every other tasks/board_sections/subtasks/
-- task_comments policy is untouched — reassigning, checking off, dragging
-- cards between columns, and renaming sections stay open to any teammate,
-- per 0007's "shared board" reasoning. Only create/delete of the project
-- itself, and delete of a task, move to manager/HR.

drop policy if exists "projects modifiable by authenticated" on public.projects;

create policy "projects insertable by manager or hr"
  on public.projects for insert
  to authenticated
  with check ((select public.current_app_role()) in ('manager', 'hr'));

create policy "projects updatable by authenticated"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

create policy "projects deletable by manager or hr"
  on public.projects for delete
  to authenticated
  using ((select public.current_app_role()) in ('manager', 'hr'));

drop policy if exists "tasks deletable by authenticated" on public.tasks;

create policy "tasks deletable by manager or hr"
  on public.tasks for delete
  to authenticated
  using ((select public.current_app_role()) in ('manager', 'hr'));
