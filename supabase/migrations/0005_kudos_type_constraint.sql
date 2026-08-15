-- The existing kudos_kudos_type_check constraint rejects every value the
-- app's tag buttons actually send ("Great teammate", "Made my day", "Went
-- above and beyond", "Really listened") — whatever enum it expected isn't
-- documented anywhere reachable from here, so replace it outright with one
-- matching the app's real tag set (lib/constants.ts KUDOS_TAGS).
alter table public.kudos drop constraint if exists kudos_kudos_type_check;

alter table public.kudos add constraint kudos_kudos_type_check
  check (kudos_type in (
    'Great teammate',
    'Made my day',
    'Went above and beyond',
    'Really listened'
  ));
