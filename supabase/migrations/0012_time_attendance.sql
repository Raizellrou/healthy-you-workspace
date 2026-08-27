-- P4: real clock in/out, breaks, and PTO — attendance stops being the
-- `daily_activity.worked_today` boolean and becomes a timestamped record.
-- lib/burnout-signals.ts (app layer, not this migration) is what feeds this
-- into burnout scoring without touching the frozen lib/burnout.ts.
--
-- Deliberately NOT included, by design:
--   - A work_day_rollup SQL view (the original plan for this phase). Every
--     other aggregate in this codebase — subtask counts, workload, employee
--     lookups — is computed in TypeScript over raw rows (see
--     lib/supabase/queries.ts, lib/tasks.ts), not in SQL views, specifically
--     so the math is unit-testable with Vitest. A rollup view would be a
--     second, untested implementation of the same logic living only in SQL.
--     lib/attendance.ts's rollupDays() is that logic instead, tested in
--     lib/__tests__/attendance.test.ts. This also sidesteps the exact
--     footgun the original plan flagged for that view: a SECURITY DEFINER-
--     by-default view silently bypassing RLS and leaking every employee's
--     hours — there's no view here to get that wrong.

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  work_date date not null,
  source text not null default 'manual' check (source in ('manual', 'edited')),
  note text,
  edited_by uuid references public.employees(id),
  edit_reason text,
  created_at timestamptz not null default now(),
  constraint work_sessions_clock_out_after_in check (clock_out is null or clock_out > clock_in)
);

-- The correctness backbone: you cannot clock in twice, regardless of what
-- the client sends. Enforced in Postgres, not a React `disabled` prop.
create unique index work_sessions_one_open_idx on public.work_sessions(employee_id) where clock_out is null;
create index work_sessions_employee_date_idx on public.work_sessions(employee_id, work_date);

create table public.session_breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.work_sessions(id) on delete cascade,
  break_start timestamptz not null default now(),
  break_end timestamptz,
  kind text not null default 'short' check (kind in ('lunch', 'short', 'nudge')),
  constraint session_breaks_end_after_start check (break_end is null or break_end > break_start)
);

-- Same guarantee, one level down: you cannot open two breaks on one session.
create unique index session_breaks_one_open_idx on public.session_breaks(session_id) where break_end is null;
create index session_breaks_session_id_idx on public.session_breaks(session_id);

create table public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  start_date date not null,
  end_date date not null,
  kind text not null check (kind in ('vacation', 'sick', 'personal', 'mental_health')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  approver_id uuid references public.employees(id),
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint pto_requests_end_after_start check (end_date >= start_date)
);
create index pto_requests_employee_id_idx on public.pto_requests(employee_id);
create index pto_requests_status_idx on public.pto_requests(status);

-- --- RLS -----------------------------------------------------------------
--
-- SELECT everywhere mirrors 0010's can_see_employee(): self, your team if
-- you manage it, or the whole org if you're HR — the same scoping already
-- proven live for daily_activity/risk_scores.
--
-- Writes follow 0010's established pattern (see its "hr can update any
-- employee" policy comment): RLS scopes WHO can touch a row, the Server
-- Action in app/(app)/attendance/actions.ts enforces WHICH fields actually
-- change. A manager/HR can reach an UPDATE on someone else's work_session
-- or pto_request (correcting a forgotten clock-out; deciding a PTO
-- request) — the action layer, not a column-level policy, is what keeps a
-- plain self-edit from also setting `status = 'approved'`.

alter table public.work_sessions enable row level security;
alter table public.session_breaks enable row level security;
alter table public.pto_requests enable row level security;

create policy "work_sessions readable by can_see_employee"
  on public.work_sessions for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

create policy "work_sessions writable by self, manager, or hr"
  on public.work_sessions for insert
  to authenticated
  with check (
    employee_id = (select public.current_employee_id())
  );

create policy "work_sessions updatable by self, manager, or hr"
  on public.work_sessions for update
  to authenticated
  using (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  )
  with check (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  );

create policy "session_breaks readable by can_see_employee"
  on public.session_breaks for select
  to authenticated
  using (
    exists (
      select 1 from public.work_sessions ws
      where ws.id = session_breaks.session_id
        and (select public.can_see_employee(ws.employee_id))
    )
  );

create policy "session_breaks writable on your own open session"
  on public.session_breaks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.work_sessions ws
      where ws.id = session_breaks.session_id
        and ws.employee_id = (select public.current_employee_id())
    )
  );

create policy "session_breaks updatable by self, manager, or hr"
  on public.session_breaks for update
  to authenticated
  using (
    exists (
      select 1 from public.work_sessions ws
      where ws.id = session_breaks.session_id
        and (
          ws.employee_id = (select public.current_employee_id())
          or (select public.manages(ws.employee_id))
          or (select public.is_hr())
        )
    )
  );

create policy "pto_requests readable by can_see_employee"
  on public.pto_requests for select
  to authenticated
  using ((select public.can_see_employee(employee_id)));

create policy "pto_requests insertable by self"
  on public.pto_requests for insert
  to authenticated
  with check (employee_id = (select public.current_employee_id()));

create policy "pto_requests updatable by self, manager, or hr"
  on public.pto_requests for update
  to authenticated
  using (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  )
  with check (
    employee_id = (select public.current_employee_id())
    or (select public.manages(employee_id))
    or (select public.is_hr())
  );
