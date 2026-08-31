/**
 * Verifies 0034_provision_employee_settings.sql actually applied.
 * Run with: npm run verify:settings
 *
 * Two assertions:
 *   1. Backfill — no existing employee is missing a work_schedules or
 *      notification_prefs row.
 *   2. Trigger — a newly inserted employee gets both rows automatically.
 *
 * Per AGENTS.md: never assume a migration applied because the file exists.
 *
 * The trigger check inserts one throwaway employee and deletes it (and its
 * two provisioned rows) by id in a finally block, so a failed assertion still
 * cleans up. Every write here is scoped to that single id — there is no
 * unscoped UPDATE or DELETE anywhere in this script.
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

const PROBE_EMAIL = `provision-probe-${Date.now()}@petal.invalid`;

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function missingCount(table: "work_schedules" | "notification_prefs"): Promise<number> {
  const { data: employees, error: empError } = await supabase.from("employees").select("id");
  if (empError) throw new Error(`Could not read employees: ${empError.message}`);

  const { data: rows, error: rowError } = await supabase.from(table).select("employee_id");
  if (rowError) throw new Error(`Could not read ${table}: ${rowError.message}`);

  const have = new Set((rows ?? []).map((r) => r.employee_id as string));
  return (employees ?? []).filter((e) => !have.has(e.id as string)).length;
}

async function main() {
  console.log("Verifying 0034_provision_employee_settings...\n");

  // --- 1. Backfill ---------------------------------------------------------
  const missingSchedules = await missingCount("work_schedules");
  const missingPrefs = await missingCount("notification_prefs");
  check("every employee has a work_schedules row", missingSchedules === 0, `${missingSchedules} missing`);
  check("every employee has a notification_prefs row", missingPrefs === 0, `${missingPrefs} missing`);

  // --- 2. Trigger ----------------------------------------------------------
  const { data: team } = await supabase.from("teams").select("id, name").limit(1).maybeSingle();

  const { data: probe, error: insertError } = await supabase
    .from("employees")
    .insert({
      name: "Provision Probe",
      team: team?.name ?? "Engineering",
      team_id: team?.id ?? null,
      role: "Verification probe — safe to delete",
      email: PROBE_EMAIL,
      app_role: "employee",
    })
    .select("id")
    .single();

  if (insertError || !probe) {
    check("insert probe employee", false, insertError?.message ?? "no row returned");
    return;
  }

  try {
    const [{ data: sched }, { data: prefs }] = await Promise.all([
      supabase.from("work_schedules").select("employee_id, workdays, start_min").eq("employee_id", probe.id).maybeSingle(),
      supabase.from("notification_prefs").select("employee_id, batching_mode").eq("employee_id", probe.id).maybeSingle(),
    ]);

    check("trigger created work_schedules row", sched !== null, sched ? `start_min=${sched.start_min}` : "absent");
    check("trigger created notification_prefs row", prefs !== null, prefs ? `mode=${prefs.batching_mode}` : "absent");
  } finally {
    // Scoped to the single id created above, in a finally so a failed
    // assertion above still cleans up. Children first — both tables carry a
    // foreign key to employees.id.
    await supabase.from("work_schedules").delete().eq("employee_id", probe.id);
    await supabase.from("notification_prefs").delete().eq("employee_id", probe.id);
    await supabase.from("employees").delete().eq("id", probe.id);
    console.log(`\nCleaned up probe employee ${probe.id}`);
  }
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error("\nVerification error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
