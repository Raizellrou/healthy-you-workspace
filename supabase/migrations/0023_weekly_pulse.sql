-- P8 item 9: the weekly anonymous pulse.
--
-- One rotating question per week, answered on a 1-5 scale, aggregated at
-- n>=3 and never readable per person. Same anti-de-anonymisation floor the
-- mood pillar has enforced since 0003 (get_team_mood_aggregate) and 0016
-- (get_org_mood_trend) — a pulse that a manager can unpick into individual
-- answers is a performance review, not a pulse, and people answer it
-- accordingly.
--
-- ANONYMITY IS ENFORCED HERE, NOT IN THE UI:
--
--   * pulse_responses has NO SELECT POLICY AT ALL. Not "self only" — none.
--     Nobody, at any role, can read a row through PostgREST. Even the
--     person who wrote it cannot read it back. Everything the app displays
--     comes from get_pulse_results(), a security-definer aggregate that
--     refuses to return a mean until at least 3 people have answered.
--
--   * The unique constraint is on (question_id, employee_id), which does
--     mean the table knows who answered. That is unavoidable if answering
--     twice is to be prevented, and it is the honest trade: the app can
--     tell THAT you answered, never WHAT you answered. has_answered()
--     exposes exactly that one bit, for the current user only, so the UI
--     can stop re-asking.

create table public.pulse_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (char_length(prompt) between 1 and 300),
  -- The Monday of the week this question runs. One question per week.
  week_start date not null unique,
  low_label text not null default 'Strongly disagree',
  high_label text not null default 'Strongly agree',
  created_at timestamptz not null default now()
);

create table public.pulse_responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.pulse_questions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  constraint pulse_responses_one_per_person unique (question_id, employee_id)
);

create index pulse_responses_question_idx on public.pulse_responses(question_id);

alter table public.pulse_questions enable row level security;
alter table public.pulse_responses enable row level security;

-- Questions are public reading; there is nothing sensitive in a prompt.
create policy "pulse_questions readable by authenticated"
  on public.pulse_questions for select
  to authenticated
  using (true);

-- Answering is insert-as-self. Note the deliberate absence of any SELECT,
-- UPDATE, or DELETE policy on this table: an answer, once given, is not
-- readable or editable by anyone through the table API — including its
-- author. This is the whole anonymity guarantee.
create policy "pulse_responses insertable as self"
  on public.pulse_responses for insert
  to authenticated
  with check (employee_id = (select public.current_employee_id()));

/**
 * Aggregate for one question. Returns a null average until 3 people have
 * answered, matching get_team_mood_aggregate's floor exactly.
 *
 * Also returns the distribution, but only once the floor is cleared —
 * publishing "1 person answered, and they said 1" would identify them just
 * as effectively as naming them.
 */
create or replace function public.get_pulse_results(target_question_id uuid)
returns table (response_count integer, avg_score numeric, dist_1 integer, dist_2 integer, dist_3 integer, dist_4 integer, dist_5 integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::integer as response_count,
    case when count(*) >= 3 then round(avg(score), 2) else null end as avg_score,
    case when count(*) >= 3 then count(*) filter (where score = 1)::integer else null end as dist_1,
    case when count(*) >= 3 then count(*) filter (where score = 2)::integer else null end as dist_2,
    case when count(*) >= 3 then count(*) filter (where score = 3)::integer else null end as dist_3,
    case when count(*) >= 3 then count(*) filter (where score = 4)::integer else null end as dist_4,
    case when count(*) >= 3 then count(*) filter (where score = 5)::integer else null end as dist_5
  from public.pulse_responses
  where question_id = target_question_id;
$$;

/** Trend across every past question that cleared the floor. */
create or replace function public.get_pulse_trend(limit_weeks integer default 12)
returns table (week_start date, prompt text, response_count integer, avg_score numeric)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.week_start,
    q.prompt,
    count(r.id)::integer as response_count,
    case when count(r.id) >= 3 then round(avg(r.score), 2) else null end as avg_score
  from public.pulse_questions q
  left join public.pulse_responses r on r.question_id = q.id
  group by q.id, q.week_start, q.prompt
  order by q.week_start desc
  limit limit_weeks;
$$;

/**
 * The single bit of per-person state the UI legitimately needs: have YOU
 * already answered this one. Scoped to the caller and returns a boolean,
 * never a score — there is no argument for whose answer to check because
 * it can only ever be your own.
 */
create or replace function public.has_answered_pulse(target_question_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.pulse_responses
    where question_id = target_question_id
      and employee_id = public.current_employee_id()
  );
$$;

revoke execute on function public.get_pulse_results(uuid) from public, anon;
revoke execute on function public.get_pulse_trend(integer) from public, anon;
revoke execute on function public.has_answered_pulse(uuid) from public, anon;
grant execute on function public.get_pulse_results(uuid) to authenticated;
grant execute on function public.get_pulse_trend(integer) to authenticated;
grant execute on function public.has_answered_pulse(uuid) to authenticated;

-- Seed the rotating question bank: this week plus the eleven before it, so
-- the trend view has history on day one. week_start is the Monday.
insert into public.pulse_questions (prompt, week_start, low_label, high_label)
select
  prompt,
  (date_trunc('week', current_date) - (offset_weeks || ' weeks')::interval)::date,
  low_label,
  high_label
from (
  values
    ('I had enough uninterrupted time to do my best work this week.', 0, 'Not at all', 'More than enough'),
    ('I felt comfortable raising a concern this week.', 1, 'Not at all', 'Completely'),
    ('My workload this week was sustainable.', 2, 'Not sustainable', 'Very sustainable'),
    ('I knew what was expected of me this week.', 3, 'Not at all', 'Completely'),
    ('I was able to switch off outside working hours.', 4, 'Never', 'Always'),
    ('I felt recognised for my work this week.', 5, 'Not at all', 'Very much'),
    ('Meetings this week were a good use of my time.', 6, 'Strongly disagree', 'Strongly agree'),
    ('I had the support I needed to get my work done.', 7, 'Not at all', 'Completely'),
    ('I felt connected to my team this week.', 8, 'Not at all', 'Very connected'),
    ('I could take a break when I needed one.', 9, 'Never', 'Always'),
    ('The priorities I was given were clear and stable.', 10, 'Not at all', 'Completely'),
    ('I would recommend this as a good place to work.', 11, 'Strongly disagree', 'Strongly agree')
) as bank(prompt, offset_weeks, low_label, high_label)
on conflict (week_start) do nothing;
