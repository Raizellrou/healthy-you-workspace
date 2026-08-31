/**
 * One-time seed script: creates one real Supabase Auth + employees row per
 * app_role ('employee', 'manager', 'hr') — separate from the 24-person
 * seeded org (scripts/seed.ts), for exercising role-gated UI/RLS without
 * touching real people's accounts or the 4 teams' existing manager_id
 * assignments. Run with: npm run seed:roles
 *
 * Note on scope: these accounts get app_role set directly, so any check
 * keyed on app_role alone (e.g. 0030_project_rls.sql's manager/hr project
 * policies) sees them correctly. They are NOT set as any team's
 * teams.manager_id, so the team-scoped "manager sees their team" RLS
 * (0010_rls_v2.sql) won't show the QA Manager account extra team members
 * beyond the ordinary self-scope — deliberately, to avoid displacing the
 * real manager already assigned to Engineering.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. Safe to re-run:
 * accounts that already exist (matched by email) are skipped.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const TEST_PASSWORD = "Petal2026";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface RoleAccount {
  name: string;
  role: string; // job-title text, matches employees.role's existing usage
  appRole: "employee" | "manager" | "hr";
  email: string;
}

const ACCOUNTS: RoleAccount[] = [
  { name: "QA Employee", role: "QA Test Account", appRole: "employee", email: "qa-employee@petal.test" },
  { name: "QA Manager", role: "QA Test Account", appRole: "manager", email: "qa-manager@petal.test" },
  { name: "QA HR", role: "QA Test Account", appRole: "hr", email: "qa-hr@petal.test" },
];

/** Inserts default work_schedules/notification_prefs rows for `employeeId`
 *  if they don't already exist — column defaults only (see
 *  0014_notifications_and_schedules.sql), same as that migration's own
 *  backfill for the original 24. `on conflict do nothing` makes this safe
 *  to call for an employee that already has rows. */
async function ensureScheduleAndPrefs(employeeId: string): Promise<void> {
  await supabase
    .from("work_schedules")
    .upsert({ employee_id: employeeId }, { onConflict: "employee_id", ignoreDuplicates: true });
  await supabase
    .from("notification_prefs")
    .upsert({ employee_id: employeeId }, { onConflict: "employee_id", ignoreDuplicates: true });
}

async function seed() {
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name")
    .eq("name", "Engineering")
    .single();

  if (teamError || !team) {
    console.error("Could not find the Engineering team to attach test accounts to:", teamError?.message);
    process.exit(1);
  }

  console.log(`Seeding ${ACCOUNTS.length} role test accounts (team: ${team.name})...\n`);

  for (const account of ACCOUNTS) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id, auth_user_id")
      .eq("email", account.email)
      .maybeSingle();

    if (existing) {
      // Heals partial state from an earlier run: 0014_notifications_and_schedules.sql
      // backfilled work_schedules/notification_prefs for every employee that
      // existed at that migration's time, but nothing does that for an
      // employee inserted afterward (getMySettings' .single() calls throw
      // otherwise — this is what "add them to a team" actually needed).
      await ensureScheduleAndPrefs(existing.id);
      console.log(`- ${account.name} (${account.email}): already exists, skipping`);
      continue;
    }

    const { data: employee, error: insertError } = await supabase
      .from("employees")
      .insert({
        name: account.name,
        team: team.name,
        team_id: team.id,
        role: account.role,
        email: account.email,
        app_role: account.appRole,
      })
      .select("id")
      .single();

    if (insertError || !employee) {
      console.error(`✗ ${account.name}: employee insert failed: ${insertError?.message}`);
      continue;
    }

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (createError) {
      console.error(`✗ ${account.name} (${account.email}): auth user creation failed: ${createError.message}`);
      await supabase.from("employees").delete().eq("id", employee.id);
      continue;
    }

    const { error: linkError } = await supabase
      .from("employees")
      .update({ auth_user_id: authData.user.id })
      .eq("id", employee.id);

    if (linkError) {
      console.error(`✗ ${account.name}: auth user created but link failed: ${linkError.message}`);
      continue;
    }

    await ensureScheduleAndPrefs(employee.id);
    console.log(`✓ ${account.name} — ${account.appRole} (${account.email})`);
  }

  console.log(`\nDone. Password for all role test accounts: ${TEST_PASSWORD}`);
  console.log("Shared test password for local/internal exploration only — do not reuse it anywhere real.");
}

seed();
