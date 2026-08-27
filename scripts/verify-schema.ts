/**
 * Asserts the live schema matches what 0008_baseline_schema.sql and the
 * migrations before it are supposed to produce. Run with: npm run verify:schema
 *
 * This is schema verification, not RLS testing — it runs with the service
 * role key, which bypasses RLS by design, so it can see every table
 * regardless of policy. It answers "does the shape exist", not "who can read
 * it". RLS behaviour itself needs a separate check signed in as an anon
 * user under each role, which is what P2's scripts/verify-rls.ts is for.
 *
 * Per AGENTS.md: never assume a migration applied because the file exists.
 * Run this after every SQL Editor paste.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ColumnSpec {
  name: string;
  /** A prefix match against information_schema.columns.data_type — Postgres
   *  reports "timestamp with time zone", "character varying", etc. in full. */
  type: string;
}

interface TableSpec {
  table: string;
  columns: ColumnSpec[];
}

const EXPECTED: TableSpec[] = [
  {
    table: "employees",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "team", type: "text" },
      { name: "role", type: "text" },
      { name: "email", type: "text" },
      { name: "auth_user_id", type: "uuid" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  {
    table: "daily_activity",
    columns: [
      { name: "id", type: "uuid" },
      { name: "employee_id", type: "uuid" },
      { name: "date", type: "date" },
      { name: "meeting_hours", type: "numeric" },
      { name: "available_hours", type: "numeric" },
      { name: "off_hours_messages", type: "integer" },
      { name: "worked_today", type: "boolean" },
      { name: "on_pto", type: "boolean" },
    ],
  },
  {
    table: "risk_scores",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "computed_date", type: "date" },
      { name: "composite_score", type: "numeric" },
      { name: "band", type: "text" },
    ],
  },
  {
    table: "nudge_events",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "nudge_type", type: "text" },
      { name: "triggered_at", type: "timestamp" },
      { name: "acknowledged", type: "boolean" },
      // 0016_pillars_real.sql (P7)
      { name: "result", type: "text" },
      { name: "reason", type: "text" },
      { name: "session_id", type: "uuid" },
      { name: "responded_at", type: "timestamp" },
    ],
  },
  {
    table: "nudge_preferences",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "quiet_hours_start", type: "time" },
      { name: "quiet_hours_end", type: "time" },
      { name: "max_nudges_per_day", type: "integer" },
      // 0016_pillars_real.sql (P7)
      { name: "types_enabled", type: "ARRAY" },
      { name: "cadence_minutes", type: "integer" },
      { name: "daily_cap", type: "integer" },
      { name: "respect_focus", type: "boolean" },
    ],
  },
  {
    table: "mood_checkins",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "date", type: "date" },
      { name: "mood_value", type: "smallint" },
      { name: "note", type: "text" },
      { name: "energy", type: "smallint" },
    ],
  },
  {
    table: "kudos",
    columns: [
      { name: "from_employee_id", type: "uuid" },
      { name: "to_employee_id", type: "uuid" },
      { name: "kudos_type", type: "text" },
      { name: "message", type: "text" },
      { name: "flagged", type: "boolean" },
    ],
  },
  {
    table: "boundary_events",
    columns: [
      { name: "sender_id", type: "uuid" },
      { name: "recipient_id", type: "uuid" },
      { name: "channel", type: "text" },
      { name: "action", type: "text" },
      { name: "scheduled_delivery", type: "timestamp" },
    ],
  },
  // The 5 task-engine tables (0006) — included so this script is the one
  // place that checks the whole schema, not just the baseline capture.
  {
    table: "projects",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "color", type: "text" },
    ],
  },
  {
    table: "board_sections",
    columns: [
      { name: "project_id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "position", type: "integer" },
    ],
  },
  {
    table: "tasks",
    columns: [
      { name: "project_id", type: "uuid" },
      { name: "section_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "assignee_id", type: "uuid" },
      { name: "created_by", type: "uuid" },
      { name: "priority", type: "text" },
      { name: "due_date", type: "date" },
      { name: "done", type: "boolean" },
      // Added by 0011_task_engine.sql (P3 — the task engine).
      { name: "start_date", type: "date" },
      { name: "estimate_hours", type: "numeric" },
      { name: "completed_at", type: "timestamp" },
      { name: "blocked_by", type: "uuid" },
    ],
  },
  {
    table: "subtasks",
    columns: [
      { name: "task_id", type: "uuid" },
      { name: "title", type: "text" },
      { name: "done", type: "boolean" },
    ],
  },
  {
    table: "task_comments",
    columns: [
      { name: "task_id", type: "uuid" },
      { name: "author_id", type: "uuid" },
      { name: "body", type: "text" },
    ],
  },
  // 0011_task_engine.sql (P3)
  {
    table: "labels",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "color", type: "text" },
    ],
  },
  {
    table: "task_labels",
    columns: [
      { name: "task_id", type: "uuid" },
      { name: "label_id", type: "uuid" },
    ],
  },
  {
    table: "task_events",
    columns: [
      { name: "id", type: "uuid" },
      { name: "task_id", type: "uuid" },
      { name: "actor_id", type: "uuid" },
      { name: "kind", type: "text" },
      { name: "from_value", type: "text" },
      { name: "to_value", type: "text" },
      { name: "is_off_hours", type: "boolean" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  // 0012_time_attendance.sql (P4)
  {
    table: "work_sessions",
    columns: [
      { name: "id", type: "uuid" },
      { name: "employee_id", type: "uuid" },
      { name: "clock_in", type: "timestamp" },
      { name: "clock_out", type: "timestamp" },
      { name: "work_date", type: "date" },
      { name: "source", type: "text" },
      { name: "note", type: "text" },
      { name: "edited_by", type: "uuid" },
      { name: "edit_reason", type: "text" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  {
    table: "session_breaks",
    columns: [
      { name: "id", type: "uuid" },
      { name: "session_id", type: "uuid" },
      { name: "break_start", type: "timestamp" },
      { name: "break_end", type: "timestamp" },
      { name: "kind", type: "text" },
    ],
  },
  {
    table: "pto_requests",
    columns: [
      { name: "id", type: "uuid" },
      { name: "employee_id", type: "uuid" },
      { name: "start_date", type: "date" },
      { name: "end_date", type: "date" },
      { name: "kind", type: "text" },
      { name: "status", type: "text" },
      { name: "approver_id", type: "uuid" },
      { name: "decided_at", type: "timestamp" },
      { name: "note", type: "text" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  // 0013_task_views.sql (P5)
  {
    table: "task_views",
    columns: [
      { name: "id", type: "uuid" },
      { name: "owner_id", type: "uuid" },
      { name: "project_id", type: "uuid" },
      { name: "name", type: "text" },
      { name: "layout", type: "text" },
      { name: "filters", type: "jsonb" },
      { name: "is_shared", type: "boolean" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  // 0014_notifications_and_schedules.sql (P6)
  {
    table: "work_schedules",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "workdays", type: "ARRAY" },
      { name: "start_min", type: "integer" },
      { name: "end_min", type: "integer" },
      { name: "quiet_start_min", type: "integer" },
      { name: "quiet_end_min", type: "integer" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  {
    table: "notification_prefs",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "batching_mode", type: "text" },
      { name: "muted_kinds", type: "ARRAY" },
      { name: "created_at", type: "timestamp" },
    ],
  },
  {
    table: "notifications",
    columns: [
      { name: "id", type: "uuid" },
      { name: "recipient_id", type: "uuid" },
      { name: "actor_id", type: "uuid" },
      { name: "kind", type: "text" },
      { name: "title", type: "text" },
      { name: "body", type: "text" },
      { name: "link", type: "text" },
      { name: "entity_type", type: "text" },
      { name: "entity_id", type: "uuid" },
      { name: "priority", type: "text" },
      { name: "created_at", type: "timestamp" },
      { name: "deliver_after", type: "timestamp" },
      { name: "held_reason", type: "text" },
      { name: "read_at", type: "timestamp" },
      { name: "dismissed_at", type: "timestamp" },
    ],
  },
  {
    table: "mentions",
    columns: [
      { name: "comment_id", type: "uuid" },
      { name: "mentioned_employee_id", type: "uuid" },
    ],
  },
  // 0016_pillars_real.sql (P7)
  {
    table: "focus_sessions",
    columns: [
      { name: "id", type: "uuid" },
      { name: "employee_id", type: "uuid" },
      { name: "started_at", type: "timestamp" },
      { name: "ended_at", type: "timestamp" },
      { name: "mode", type: "text" },
      { name: "trigger", type: "text" },
      { name: "tasks_completed", type: "integer" },
      { name: "notifications_suppressed", type: "integer" },
    ],
  },
  {
    table: "ui_preferences",
    columns: [
      { name: "employee_id", type: "uuid" },
      { name: "reduced_motion", type: "boolean" },
      { name: "high_contrast", type: "boolean" },
      { name: "font_scale", type: "numeric" },
      { name: "density", type: "text" },
      { name: "single_column", type: "boolean" },
      { name: "muted_palette", type: "boolean" },
      { name: "hide_avatars", type: "boolean" },
      { name: "default_task_view", type: "text" },
    ],
  },
  {
    table: "buddy_pairings",
    columns: [
      { name: "id", type: "uuid" },
      { name: "week_start", type: "date" },
      { name: "employee_a", type: "uuid" },
      { name: "employee_b", type: "uuid" },
    ],
  },
  {
    table: "coffee_chats",
    columns: [
      { name: "id", type: "uuid" },
      { name: "proposer_id", type: "uuid" },
      { name: "invitee_id", type: "uuid" },
      { name: "status", type: "text" },
      { name: "scheduled_at", type: "timestamp" },
    ],
  },
  {
    table: "concern_flags",
    columns: [
      { name: "id", type: "uuid" },
      { name: "about_employee_id", type: "uuid" },
      { name: "raised_by_id", type: "uuid" },
      { name: "category", type: "text" },
      { name: "note", type: "text" },
      { name: "status", type: "text" },
      { name: "acknowledged_by", type: "uuid" },
      { name: "acknowledged_at", type: "timestamp" },
    ],
  },
  {
    table: "interventions",
    columns: [
      { name: "id", type: "uuid" },
      { name: "employee_id", type: "uuid" },
      { name: "created_by", type: "uuid" },
      { name: "driver", type: "text" },
      { name: "action_type", type: "text" },
      { name: "status", type: "text" },
      { name: "score_at_creation", type: "integer" },
      { name: "note", type: "text" },
      { name: "related_pto_request_id", type: "uuid" },
      { name: "resolved_at", type: "timestamp" },
    ],
  },
];

/** (table, constraint name substring) pairs that must exist. */
const EXPECTED_CONSTRAINTS: [string, string][] = [
  ["mood_checkins", "employee_date_unique"],
  ["daily_activity", "employee_id_date_key"],
  ["kudos", "kudos_type_check"],
  ["tasks", "priority_check"],
  ["tasks", "title_length_check"],
  ["tasks", "description_length_check"],
  ["tasks", "estimate_hours_check"],
  ["work_sessions", "clock_out_after_in"],
  ["session_breaks", "end_after_start"],
  ["pto_requests", "end_after_start"],
  ["mood_checkins", "energy_check"],
  ["concern_flags", "note_check"],
];

/** Tables that must have row level security enabled. */
const EXPECTED_RLS_ENABLED = [
  "employees",
  "daily_activity",
  "risk_scores",
  "nudge_events",
  "nudge_preferences",
  "mood_checkins",
  "kudos",
  "boundary_events",
  "projects",
  "board_sections",
  "tasks",
  "subtasks",
  "task_comments",
  "labels",
  "task_labels",
  "task_events",
  "work_sessions",
  "session_breaks",
  "pto_requests",
  "task_views",
  "work_schedules",
  "notification_prefs",
  "notifications",
  "mentions",
  // 0016_pillars_real.sql (P7)
  "focus_sessions",
  "ui_preferences",
  "buddy_pairings",
  "coffee_chats",
  "concern_flags",
  // 0019_interventions.sql (P8)
  "interventions",
];

interface InfoColumn {
  table_name: string;
  column_name: string;
  data_type: string;
}

interface ConstraintRow {
  conrelid: string;
  conname: string;
}

interface RlsRow {
  relname: string;
  relrowsecurity: boolean;
}

/**
 * information_schema.columns, pg_constraint, and pg_policies aren't exposed
 * through PostgREST's table API, so this goes through three small
 * SECURITY DEFINER helper functions instead — `_verify_columns`,
 * `_verify_constraints`, `_verify_rls`. They're created by
 * supabase/migrations/0008_baseline_schema.sql. If they're missing, that
 * migration hasn't been applied yet — this script isn't the place to create
 * them (it has no way to run arbitrary SQL against the project either).
 */
async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    console.log(`  ✗ ${msg}`);
    failures++;
  };
  const pass = (msg: string) => console.log(`  ✓ ${msg}`);

  const [columnsRes, constraintsRes, rlsRes] = await Promise.all([
    supabase.rpc("_verify_columns"),
    supabase.rpc("_verify_constraints"),
    supabase.rpc("_verify_rls"),
  ]);

  if (columnsRes.error || constraintsRes.error || rlsRes.error) {
    console.log(
      "Helper functions are missing — 0008_baseline_schema.sql hasn't been applied yet.\n" +
        "Paste that migration into the Supabase SQL Editor, then re-run this script."
    );
    process.exit(1);
  }

  const columns = (columnsRes.data ?? []) as InfoColumn[];
  const constraints = (constraintsRes.data ?? []) as ConstraintRow[];
  const rls = (rlsRes.data ?? []) as RlsRow[];

  const columnsByTable = new Map<string, InfoColumn[]>();
  for (const col of columns) {
    const list = columnsByTable.get(col.table_name) ?? [];
    list.push(col);
    columnsByTable.set(col.table_name, list);
  }

  console.log("Tables and columns\n");
  for (const spec of EXPECTED) {
    const actual = columnsByTable.get(spec.table);
    if (!actual) {
      fail(`${spec.table} — missing`);
      continue;
    }
    const actualNames = new Set(actual.map((c) => c.column_name));
    const missing = spec.columns.filter((c) => !actualNames.has(c.name));
    const typeMismatches = spec.columns.filter((c) => {
      const found = actual.find((a) => a.column_name === c.name);
      return found && !found.data_type.startsWith(c.type);
    });

    if (missing.length === 0 && typeMismatches.length === 0) {
      pass(`${spec.table} (${actual.length} columns)`);
    } else {
      for (const m of missing) fail(`${spec.table} — column ${m.name} missing`);
      for (const m of typeMismatches) fail(`${spec.table} — column ${m.name} has unexpected type`);
    }
  }

  console.log("\nConstraints\n");
  for (const [table, substring] of EXPECTED_CONSTRAINTS) {
    const found = constraints.some(
      (c) => c.conrelid === table && c.conname.includes(substring)
    );
    if (found) pass(`${table} — constraint matching "${substring}"`);
    else fail(`${table} — no constraint matching "${substring}"`);
  }

  console.log("\nRow level security\n");
  const rlsByTable = new Map(rls.map((r) => [r.relname, r.relrowsecurity]));
  for (const table of EXPECTED_RLS_ENABLED) {
    const enabled = rlsByTable.get(table);
    if (enabled === true) pass(`${table} — RLS enabled`);
    else if (enabled === false) fail(`${table} — RLS exists but is NOT enabled`);
    else fail(`${table} — table not found`);
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
