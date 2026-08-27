-- Adds free-form tags to a mood check-in (e.g. "workload", "team", "sleep").
-- Extends the existing details step (updateMoodDetails), not the one-click
-- mood-pick path.
alter table public.mood_checkins
  add column tags text[] not null default '{}';
