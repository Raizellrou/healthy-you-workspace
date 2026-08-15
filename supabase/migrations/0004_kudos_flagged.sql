-- The kudos table has no way to mark a kudos as flagged-to-HR, which the
-- app's "Flag to HR" toggle needs. Small additive column, defaults false so
-- existing (empty) data is unaffected.
alter table public.kudos
  add column if not exists flagged boolean not null default false;
