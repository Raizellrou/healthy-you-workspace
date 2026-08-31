/**
 * Verifies that the three role test accounts (scripts/seed-role-accounts.ts)
 * are scoped the way their app_role claims, by signing in as each one with
 * the anon key — the same path the browser uses — and asking the database
 * itself. Run with: npm run verify:roles
 *
 * Complements verify-rls.ts, which samples whichever employee/manager/HR
 * persona it finds first among the seeded 24. This one targets the accounts
 * that exist specifically to exercise roles, and adds the checks that matter
 * most: that an employee cannot reach anything a manager or HR can.
 *
 * Everything here is read-only except three deliberate write ATTEMPTS, and
 * each of those sets a column to the value it already holds — so a write
 * that wrongly succeeds still changes nothing. What proves the policy is the
 * matched row count, never `error`: a write blocked by RLS is not an error
 * in PostgREST, it simply matches zero rows and reports success.
 *
 * Never verify RLS with the service-role key — it bypasses every policy and
 * would report success no matter what. The admin client below is used only
 * to look up ids and current values.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const TEST_PASSWORD = "Petal2026";
const EMPLOYEE = "qa-employee@petal.test";
const MANAGER = "qa-manager@petal.test";
const HR = "qa-hr@petal.test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
const pass = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  console.log(`  ✗ ${msg}`);
  failures++;
};
const check = (condition: boolean, msg: string) => (condition ? pass(msg) : fail(msg));

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}. Run: npm run seed:roles`);
  return client;
}

async function canSee(client: SupabaseClient, targetId: string): Promise<boolean> {
  const { data } = await client.rpc("can_see_employee", { target: targetId });
  return data === true;
}

/** Attempts a no-op UPDATE and reports how many rows it matched. Zero means
 *  RLS refused it; the column is set to its current value either way. */
async function noOpUpdateRowCount(
  client: SupabaseClient,
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<number> {
  const { count } = await client.from(table).update(patch, { count: "exact" }).eq("id", id).select();
  return count ?? 0;
}

async function main() {
  const { data: people, error } = await admin
    .from("employees")
    .select("id, email, name, app_role, team_id, weekly_capacity_hours");
  if (error || !people) {
    console.error("Failed to read employees:", error?.message);
    process.exit(1);
  }

  const byEmail = new Map(people.map((p) => [p.email as string, p]));
  const employee = byEmail.get(EMPLOYEE);
  const manager = byEmail.get(MANAGER);
  const hr = byEmail.get(HR);

  if (!employee || !manager || !hr) {
    console.error(`Missing role account(s). Run: npm run seed:roles`);
    process.exit(1);
  }

  // Someone on a different team, to prove team scope actually bounds a
  // manager rather than just happening to include everyone.
  const outsider = people.find((p) => p.team_id && p.team_id !== manager.team_id && p.app_role === "employee");
  if (!outsider) {
    console.error("Need at least one employee outside the QA team to test manager scope.");
    process.exit(1);
  }

  const { data: qaTeam } = await admin
    .from("teams")
    .select("id, name, manager_id")
    .eq("id", manager.team_id)
    .maybeSingle();

  console.log(`employee=${employee.name}  manager=${manager.name}  hr=${hr.name}  outsider=${outsider.name}\n`);

  const employeeClient = await signInAs(EMPLOYEE);
  const managerClient = await signInAs(MANAGER);
  const hrClient = await signInAs(HR);

  // --- the manager wiring itself -------------------------------------------
  console.log("QA team wiring\n");
  check(qaTeam?.manager_id === manager.id, `${qaTeam?.name ?? "QA"} team is managed by ${MANAGER}`);
  check(employee.team_id === manager.team_id, "qa-employee is on the same team as qa-manager");

  const { data: managerManages } = await managerClient.rpc("manages", { target: employee.id });
  check(managerManages === true, "manages(qa-employee) is true for the manager — PTO decisions, team scope");

  // --- employee: sees only itself, is not HR --------------------------------
  console.log("\nemployee scope\n");
  const { data: employeeIsHr } = await employeeClient.rpc("is_hr");
  check(employeeIsHr !== true, "employee is not HR");

  const { data: employeeManages } = await employeeClient.rpc("manages", { target: manager.id });
  check(employeeManages !== true, "employee manages nobody");

  check(await canSee(employeeClient, employee.id), "employee can see themselves");
  check(!(await canSee(employeeClient, manager.id)), "employee CANNOT see their manager's record");
  check(!(await canSee(employeeClient, outsider.id)), "employee CANNOT see someone on another team");

  const { count: employeeFlags } = await employeeClient
    .from("concern_flags")
    .select("id", { count: "exact", head: true });
  check((employeeFlags ?? 0) === 0, "employee sees zero concern flags (HR-only queue)");

  // --- employee: cannot write anything privileged ---------------------------
  console.log("\nemployee write attempts (all should match zero rows)\n");

  // employees is a table-level policy, not column-level: proving an employee
  // has no UPDATE reach at all proves they cannot set their own app_role to
  // 'hr' either. Written as a no-op so a broken policy cannot escalate them.
  const selfWrite = await noOpUpdateRowCount(employeeClient, "employees", employee.id, {
    weekly_capacity_hours: employee.weekly_capacity_hours,
  });
  check(selfWrite === 0, "employee cannot update their own employee row (so cannot self-grant HR)");

  const otherWrite = await noOpUpdateRowCount(employeeClient, "employees", outsider.id, {
    weekly_capacity_hours: outsider.weekly_capacity_hours,
  });
  check(otherWrite === 0, "employee cannot update anyone else's employee row");

  if (qaTeam) {
    const teamWrite = await noOpUpdateRowCount(employeeClient, "teams", qaTeam.id, {
      manager_id: qaTeam.manager_id,
    });
    check(teamWrite === 0, "employee cannot reassign a team's manager");
  }

  // --- manager: team scope, but no HR powers --------------------------------
  console.log("\nmanager scope\n");
  const { data: managerIsHr } = await managerClient.rpc("is_hr");
  check(managerIsHr !== true, "manager is not HR");

  check(await canSee(managerClient, employee.id), "manager can see their own report");
  check(!(await canSee(managerClient, outsider.id)), "manager CANNOT see someone on another team");

  const { count: managerFlags } = await managerClient
    .from("concern_flags")
    .select("id", { count: "exact", head: true });
  check((managerFlags ?? 0) === 0, "manager sees zero concern flags (HR-only, not manager-visible)");

  if (qaTeam) {
    const managerTeamWrite = await noOpUpdateRowCount(managerClient, "teams", qaTeam.id, {
      manager_id: qaTeam.manager_id,
    });
    check(managerTeamWrite === 0, "manager cannot reassign a team's manager — HR only");
  }

  const managerEmployeeWrite = await noOpUpdateRowCount(managerClient, "employees", employee.id, {
    weekly_capacity_hours: employee.weekly_capacity_hours,
  });
  check(managerEmployeeWrite === 0, "manager cannot update their report's employee row — HR only");

  // --- hr: the powers the other two lack ------------------------------------
  console.log("\nhr scope\n");
  const { data: hrIsHr } = await hrClient.rpc("is_hr");
  check(hrIsHr === true, "hr is HR");
  check(await canSee(hrClient, outsider.id), "hr can see someone on a team they don't manage");

  const { count: adminFlags } = await admin.from("concern_flags").select("id", { count: "exact", head: true });
  const { count: hrFlags } = await hrClient.from("concern_flags").select("id", { count: "exact", head: true });
  check((hrFlags ?? 0) === (adminFlags ?? 0), `hr sees all ${adminFlags ?? 0} concern flag(s)`);

  if (qaTeam) {
    const hrTeamWrite = await noOpUpdateRowCount(hrClient, "teams", qaTeam.id, { manager_id: qaTeam.manager_id });
    check(hrTeamWrite === 1, "hr can reassign a team's manager");
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
