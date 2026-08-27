@AGENTS.md

## Claude Code specifics

Everything else about this project lives in AGENTS.md above, kept as a
single source of truth so it stays useful to any AI coding tool, not just
Claude Code. The items below are genuinely specific to working in this repo
through Claude Code and don't belong in AGENTS.md.

- **Preview the app through the browser tool, not a manually-run dev
  server.** `.claude/launch.json` defines the `petal-dev` configuration
  (`npm run dev`, port 3000, `autoPort: true`). Use the preview/browser
  tools against that configuration to verify UI changes — click through the
  actual feature, don't just read the code and assume it renders correctly.
- **Track multi-step work with the task list.** The Supabase migration and
  the Tasks pillar build have both spanned many steps across sessions;
  keeping them as tracked tasks (rather than only in conversation) is what
  let work resume correctly after a context compaction mid-migration.
- **Schema changes go through the user, not a direct connection.** Per
  AGENTS.md's Development Workflow, this Claude Code session has no direct
  SQL access to the hosted Supabase project. The working pattern: write the
  migration file, show it to the user to run in the Supabase SQL Editor,
  then verify with a Node script using the service-role key from
  `.env.local`. Don't assume a migration applied just because the SQL was
  presented — confirm before building UI on top of it.
