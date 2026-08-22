/**
 * Read-only schema introspection. Run with: npm run introspect
 *
 * Why this exists: the eight original tables (employees, daily_activity,
 * risk_scores, nudge_events, nudge_preferences, mood_checkins, kudos,
 * boundary_events) were created by hand in the Supabase dashboard and have no
 * CREATE TABLE anywhere in this repo. Migration 0008 has to reproduce them,
 * and guessing their shape from how the app queries them is not good enough —
 * three of those tables have no code references at all.
 *
 * Rather than requiring a SQL Editor round-trip, this reads PostgREST's
 * OpenAPI document, which reports every exposed table's columns, types,
 * nullability, defaults, primary keys and foreign keys. That is enough to
 * generate the bulk of the baseline DDL.
 *
 * What OpenAPI does NOT expose, and therefore what still needs a SQL Editor
 * paste: index definitions, RLS policy bodies, and CHECK constraint
 * expressions. The script prints a ready-to-run query for those at the end.
 *
 * Writes nothing. Never prints key material.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

/** Tables whose DDL is missing from supabase/migrations/. */
const UNDOCUMENTED = [
  "employees",
  "daily_activity",
  "risk_scores",
  "nudge_events",
  "nudge_preferences",
  "mood_checkins",
  "kudos",
  "boundary_events",
] as const;

interface OpenApiProperty {
  format?: string;
  type?: string;
  default?: unknown;
  description?: string;
  maxLength?: number;
  enum?: string[];
}

interface OpenApiDefinition {
  required?: string[];
  properties?: Record<string, OpenApiProperty>;
}

interface Column {
  name: string;
  sqlType: string;
  notNull: boolean;
  default: string | null;
  isPrimaryKey: boolean;
  foreignKey: string | null;
  enumValues: string[] | null;
}

const PK_RE = /<pk\/>/;
const FK_RE = /<fk table='([^']+)' column='([^']+)'\/>/;

/** PostgREST reports integer widths in JSON-schema spelling, not SQL. */
const TYPE_ALIASES: Record<string, string> = {
  int32: "integer",
  int64: "bigint",
  int16: "smallint",
  float4: "real",
  float8: "double precision",
};

/**
 * Postgres reports defaults already-rendered, so a function call arrives as
 * `gen_random_uuid()` but a text default arrives as the bare value `medium`.
 * Emitting that unquoted produces `default medium`, which is a syntax error —
 * or worse, resolves as a column reference. Quote anything that isn't a call,
 * a number, a boolean, or already quoted.
 */
function renderDefault(raw: string, sqlType: string): string {
  const value = raw.trim();
  if (value === "") return "''";
  if (/\(.*\)$/.test(value)) return value;
  if (/^'.*'$/.test(value) || value.includes("::")) return value;
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false|null)$/i.test(value)) return value.toLowerCase();
  // Time/date/text literals all need quoting; add an explicit cast for the
  // non-text ones so the intent survives a round-trip.
  const needsCast = !sqlType.startsWith("text") && !sqlType.startsWith("character");
  return needsCast ? `'${value.replace(/'/g, "''")}'::${sqlType}` : `'${value.replace(/'/g, "''")}'`;
}

function parseColumn(
  name: string,
  prop: OpenApiProperty,
  required: string[]
): Column {
  const description = prop.description ?? "";
  const fk = description.match(FK_RE);

  return {
    name,
    // PostgREST reports the real Postgres type in `format`; `type` is only the
    // JSON-schema kind, so `format` is what the DDL needs.
    sqlType: TYPE_ALIASES[prop.format ?? ""] ?? prop.format ?? "text",
    notNull: required.includes(name),
    default: prop.default === undefined ? null : String(prop.default),
    isPrimaryKey: PK_RE.test(description),
    foreignKey: fk ? `${fk[1]}(${fk[2]})` : null,
    enumValues: prop.enum ?? null,
  };
}

function renderCreateTable(table: string, columns: Column[]): string {
  const pk = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);

  const lines = columns.map((c) => {
    let line = `  ${c.name} ${c.sqlType}`;
    if (c.default !== null) line += ` default ${renderDefault(c.default, c.sqlType)}`;
    if (c.notNull) line += " not null";
    if (c.foreignKey) line += ` references public.${c.foreignKey}`;
    return line;
  });

  if (pk.length > 0) {
    lines.push(`  primary key (${pk.join(", ")})`);
  }

  return `create table if not exists public.${table} (\n${lines.join(",\n")}\n);`;
}

/**
 * The parts OpenAPI can't see. Printed for the user to run in the hosted
 * project's SQL Editor — this project has no direct SQL access.
 */
const SUPPLEMENTAL_QUERY = `-- Run in Supabase SQL Editor, paste the result back.
select 'INDEX' as kind, tablename as rel, indexdef as body
from pg_indexes
where schemaname = 'public'
union all
select 'POLICY', tablename,
       policyname || ' | ' || cmd || ' | roles=' || array_to_string(roles, ',') ||
       ' | using=' || coalesce(qual, '-') ||
       ' | check=' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public'
union all
select 'CONSTRAINT', conrelid::regclass::text, conname || ' | ' || pg_get_constraintdef(oid)
from pg_constraint
where connamespace = 'public'::regnamespace and contype in ('c', 'u', 'x')
union all
select 'TRIGGER', tgrelid::regclass::text, tgname || ' | ' || pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid::regclass::text not like 'pg_%'
union all
select 'FUNCTION', 'public', p.proname || ' | ' || pg_get_function_identity_arguments(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by 1, 2, 3;`;

async function introspect() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!res.ok) {
    console.error(`PostgREST returned ${res.status}. Check the project URL and key.`);
    process.exit(1);
  }

  const spec = (await res.json()) as { definitions?: Record<string, OpenApiDefinition> };
  const definitions = spec.definitions ?? {};
  const allTables = Object.keys(definitions).sort();

  const schema: Record<string, Column[]> = {};
  for (const table of allTables) {
    const def = definitions[table];
    const required = def.required ?? [];
    schema[table] = Object.entries(def.properties ?? {}).map(([name, prop]) =>
      parseColumn(name, prop, required)
    );
  }

  // --- report -------------------------------------------------------------

  console.log(`\n${allTables.length} tables exposed in public schema:\n`);
  for (const table of allTables) {
    const known = (UNDOCUMENTED as readonly string[]).includes(table);
    console.log(`  ${known ? "[no DDL in repo]" : "                "} ${table} (${schema[table].length} cols)`);
  }

  const missing = UNDOCUMENTED.filter((t) => !allTables.includes(t));
  if (missing.length > 0) {
    console.log(`\nExpected but not found: ${missing.join(", ")}`);
  }

  const unexpected = allTables.filter(
    (t) => !(UNDOCUMENTED as readonly string[]).includes(t) && !DOCUMENTED_IN_REPO.includes(t)
  );
  if (unexpected.length > 0) {
    console.log(`\nTables with no migration and not on the known list: ${unexpected.join(", ")}`);
    console.log("These need a decision before 0008 — they may be abandoned experiments.");
  }

  console.log("\n" + "=".repeat(72));
  console.log("Column detail");
  console.log("=".repeat(72));
  for (const table of allTables) {
    console.log(`\n${table}`);
    for (const c of schema[table]) {
      const flags = [
        c.isPrimaryKey ? "PK" : null,
        c.notNull ? "NOT NULL" : "nullable",
        c.default ? `default ${c.default}` : null,
        c.foreignKey ? `-> ${c.foreignKey}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`  ${c.name.padEnd(24)} ${c.sqlType.padEnd(28)} ${flags}`);
    }
  }

  const ddl = UNDOCUMENTED.filter((t) => allTables.includes(t))
    .map((t) => renderCreateTable(t, schema[t]))
    .join("\n\n");

  writeFileSync("schema-introspection.json", JSON.stringify(schema, null, 2));
  writeFileSync("schema-draft-ddl.sql", ddl + "\n");

  console.log("\n" + "=".repeat(72));
  console.log("Wrote schema-introspection.json and schema-draft-ddl.sql (both gitignored).");
  console.log("The draft DDL covers columns, types, defaults, PKs and FKs only.");
  console.log("Indexes, RLS policies, CHECK constraints and triggers are not in");
  console.log("the OpenAPI document — run this in the Supabase SQL Editor:\n");
  console.log(SUPPLEMENTAL_QUERY);
}

/** Tables whose CREATE TABLE already lives in supabase/migrations/. */
const DOCUMENTED_IN_REPO = [
  "projects",
  "board_sections",
  "tasks",
  "subtasks",
  "task_comments",
];

introspect().catch((err) => {
  console.error("Introspection failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
