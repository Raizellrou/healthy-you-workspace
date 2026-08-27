-- Board columns and task completion were two unrelated facts about the same
-- task, and nothing reconciled them: a project could show a section literally
-- named "Done" holding zero cards while four completed, struck-through tasks
-- sat in "To do". Both readings were internally consistent and the board was
-- still lying.
--
-- This binds them. One section per project may be marked terminal; completing
-- a task parks it there, and dragging a task there completes it. Sections stay
-- what they were — user-named, renameable, reorderable — this only names which
-- one means finished, the same way Jira maps a column to a Done category
-- rather than guessing from its label.

alter table public.board_sections
  add column is_terminal boolean not null default false;

-- At most one terminal section per project. A partial unique index rather than
-- a check constraint because the rule is across rows, not within one.
create unique index board_sections_one_terminal_per_project
  on public.board_sections (project_id)
  where is_terminal;

-- Backfill: adopt whichever existing section already reads as the done column.
-- `distinct on` picks exactly one per project (highest position wins) so a
-- project with both "Done" and "Completed" can't violate the index above.
update public.board_sections s
   set is_terminal = true
  from (
    select distinct on (project_id) id
      from public.board_sections
     where lower(btrim(name)) in ('done', 'complete', 'completed', 'shipped', 'finished')
     order by project_id, position desc, id
  ) pick
 where s.id = pick.id;

-- Keeps the two facts in sync on every write path. This lives in a trigger
-- rather than in the Server Actions because six of them already touch `done`
-- or `section_id` (toggleDone, updateTask, moveTask, bulkReassign,
-- applyRebalanceMoves, duplicateTask) — one shared rule in the database can't
-- drift the way six copies in application code would.
create or replace function public.sync_task_completion_section()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  terminal_id uuid;
  landing_id uuid;
  was_done boolean := coalesce(old.done, false);
  was_terminal boolean := old.section_id is not null
                          and exists (
                            select 1 from public.board_sections
                             where id = old.section_id and is_terminal
                          );
begin
  select id into terminal_id
    from public.board_sections
   where project_id = new.project_id and is_terminal
   limit 1;

  -- A project with no terminal section keeps the old behaviour exactly:
  -- sections and completion stay independent, nothing moves on its own.
  if terminal_id is null then
    return new;
  end if;

  if new.done and not was_done then
    -- Completing a task parks it in the terminal column.
    new.section_id := terminal_id;

  elsif new.section_id = terminal_id and not new.done then
    -- Dragging a task into the terminal column completes it.
    new.done := true;

  elsif was_done and not new.done and new.section_id = terminal_id then
    -- Reopening a task that is still parked: send it back to the first
    -- working column, so it doesn't sit open inside the done column.
    select id into landing_id
      from public.board_sections
     where project_id = new.project_id and not is_terminal
     order by position, id
     limit 1;
    new.section_id := landing_id;

  elsif was_terminal and new.section_id is distinct from terminal_id and new.done then
    -- Dragging a task out of the terminal column reopens it.
    new.done := false;
  end if;

  return new;
end;
$$;

create trigger tasks_sync_completion_section
  before insert or update of done, section_id on public.tasks
  for each row
  execute function public.sync_task_completion_section();

-- Reconcile the rows that are already inconsistent, in both directions.
update public.tasks t
   set section_id = s.id
  from public.board_sections s
 where s.project_id = t.project_id
   and s.is_terminal
   and t.done
   and t.section_id is distinct from s.id;

update public.tasks t
   set done = true
  from public.board_sections s
 where s.id = t.section_id
   and s.is_terminal
   and not t.done;
