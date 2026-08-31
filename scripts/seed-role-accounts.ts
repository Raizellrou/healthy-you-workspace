/**
 * Seeds one real Supabase Auth + employees row per app_role ('employee',
 * 'manager', 'hr'), plus the team wiring those roles need to actually be
 * exercisable — separate from the 24-person seeded org (scripts/seed.ts).
 * Run with: npm run seed:roles
 *
 * The three accounts live on their own "QA" team, managed by the QA Manager
 * account. That team is the whole point of this script, not a detail:
 * app_role alone is not enough to exercise the manager role. Everything
 * team-scoped keys off `manages(target)` in 0010_rls_v2.sql, which is
 * `teams.manager_id = me` — so an account with app_role 'manager' that
 * manages no team sees exactly what an employee sees, and cannot approve
 * anyone's PTO (app/(app)/attendance/actions.ts#decidePto calls that same
 * RPC). An earlier revision of this script left these accounts on
 * Engineering with no manager_id to avoid displacing that team's real
 * manager, which meant the QA Manager account could never test the role it
 * was created for.
 *
 * A dedicated team solves both halves: the QA Manager gets real reports
 * without touching the four operational teams' manager assignments, and
 * three activity-less test accounts stop skewing Engineering's headcount
 * and burnout/mood aggregates.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. Safe to re-run: every
 * write is scoped to a specific row id belonging to one of the three
 * accounts or to the QA team, and an account that already exists is
 * re-wired rather than duplicated.
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

const QA_TEAM_NAME = "QA";
const MANAGER_EMAIL = "qa-manager@petal.test";

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

/** Finds the QA team, creating it if this is the first run. Never touches
 *  the four operational teams — it is matched by its own unique name. */
async function ensureQaTeam(): Promise<{ id: string; name: string; manager_id: string | null }> {
  const { data: existing } = await supabase
    .from("teams")
    .select("id, name, manager_id")
    .eq("name", QA_TEAM_NAME)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("teams")
    .insert({ name: QA_TEAM_NAME })
    .select("id, name, manager_id")
    .single();
  if (error || !created) {
    console.error(`Could not create the ${QA_TEAM_NAME} team:`, error?.message);
    process.exit(1);
  }
  console.log(`✓ Created the ${QA_TEAM_NAME} team`);
  return created;
}

async function seed() {
  const team = await ensureQaTeam();

  console.log(`Seeding ${ACCOUNTS.length} role test accounts (team: ${team.name})...\n`);

  /** employees.id per email, for the manager assignment after the loop. */
  const seeded = new Map<string, string>();

  for (const account of ACCOUNTS) {
    const { data: existing } = await supabase
      .from("employees")
      .select("id, auth_user_id, team_id")
      .eq("email", account.email)
      .maybeSingle();

    if (existing) {
      // Heals partial state from an earlier run: 0014_notifications_and_schedules.sql
      // backfilled work_schedules/notification_prefs for every employee that
      // existed at that migration's time, but nothing does that for an
      // employee inserted afterward (getMySettings' .single() calls throw
      // otherwise — this is what "add them to a team" actually needed).
      await ensureScheduleAndPrefs(existing.id);
      seeded.set(account.email, existing.id);

      // Moves an account seeded by the earlier revision of this script off
      // whatever team it landed on. Scoped to this one row by id; the
      // employees_sync_team_name trigger (0009) rewrites the `team` text
      // column to match.
      if (existing.team_id !== team.id) {
        const { error } = await supabase
          .from("employees")
          .update({ team_id: team.id })
          .eq("id", existing.id);
        if (error) console.error(`✗ ${account.name}: could not move to ${team.name}: ${error.message}`);
        else console.log(`↻ ${account.name} (${account.email}): moved to ${team.name}`);
        continue;
      }

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
    seeded.set(account.email, employee.id);
    console.log(`✓ ${account.name} — ${account.appRole} (${account.email})`);
  }

  // The manager assignment, which is what makes the 'manager' account
  // testable at all. Scoped to the QA team's own id, so the four
  // operational teams' manager_id values are never read or written here.
  const qaManagerId = seeded.get(MANAGER_EMAIL);
  if (!qaManagerId) {
    console.error(`\n✗ ${MANAGER_EMAIL} is missing, so the ${team.name} team has no manager.`);
  } else if (team.manager_id === qaManagerId) {
    console.log(`\n- ${team.name} is already managed by ${MANAGER_EMAIL}`);
  } else {
    const { error } = await supabase.from("teams").update({ manager_id: qaManagerId }).eq("id", team.id);
    if (error) console.error(`\n✗ Could not set ${team.name}'s manager: ${error.message}`);
    else console.log(`\n✓ ${team.name} is now managed by ${MANAGER_EMAIL}`);
  }

  console.log(`\nDone. Password for all role test accounts: ${TEST_PASSWORD}`);
  console.log("Shared test password for local/internal exploration only — do not reuse it anywhere real.");
  console.log(
    `\nWhat each account should now see:\n` +
      `  qa-employee  self only\n` +
      `  qa-manager   the ${team.name} team (all three accounts), and can decide their PTO\n` +
      `  qa-hr        the whole org, plus /teams and /insights`
  );
}

seed();
