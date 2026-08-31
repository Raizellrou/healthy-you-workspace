-- Soft-delete for tasks (audit H4): deleteTask previously issued a hard
-- DELETE with no recovery path. Adds a nullable deleted_at column;
-- app/(app)/tasks/actions.ts now sets it instead of deleting the row, and
-- every read path filters `deleted_at is null`.
--
-- No RLS policy change needed: the existing select/update/delete policies
-- on `tasks` (0007_tasks_rls.sql) are already `using (true)` — this is a
-- single-org app, not multi-tenant — so soft-deleted rows are hidden by
-- the application query layer, not by RLS.

alter table public.tasks add column deleted_at timestamptz;
