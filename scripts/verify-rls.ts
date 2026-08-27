/**
 * Verifies RLS scoping (0010_rls_v2.sql) by actually signing in — with the
 * anon key, through the same auth path the browser uses — as one employee,
 * one manager, and the HR account, and checking what each session can
 * read. Run with: npm run verify:rls
 *
 * This is the check `verify-schema.ts` can't do: that script uses the
 * service role, which bypasses RLS by design, so it can only confirm a
 * policy EXISTS, never that it actually restricts anything. Signing in as
 * a real low-privilege session is the only way to prove that.
 *
 * Never verify RLS with the service-role key — it will report success
 * regardless of whether the policy works.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DEMO_PASSWORD = "petal-demo-2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
const pass = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  console.log(`  ✗ ${msg}`);
  failures++;
};

async function signInAs(email: string) {
  const client = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  // Pick one example of each role via the admin client (read-only here —
  // this script never writes).
  const { data: employees, error } = await admin
    .from("employees")
    .select("id, email, name, app_role, team_id")
    .order("name");
  if (error || !employees) {
    console.error("Failed to read employees:", error?.message);
    process.exit(1);
  }

  const hr = employees.find((e) => e.app_role === "hr");
  const manager = employees.find((e) => e.app_role === "manager");
  const plainEmployee = employees.find((e) => e.app_role === "employee");

  if (!hr || !manager || !plainEmployee) {
    console.error(
      `Need at least one of each role to verify. Found: hr=${!!hr} manager=${!!manager} employee=${!!plainEmployee}. ` +
        "Has 0009_teams_and_roles.sql been applied?"
    );
    process.exit(1);
  }

  console.log(`Testing as: employee=${plainEmployee.name}, manager=${manager.name}, hr=${hr.name}\n`);

  // The real basis for comparison: daily_activity is one row PER DAY per
  // person, not one row per person, and different people have accumulated
  // different history depths — so "expected" has to come from counting
  // actual rows via the admin client, never from headcount.
  async function activityRowCountFor(employeeIds: string[]): Promise<number> {
    const { count } = await admin
      .from("daily_activity")
      .select("id", { count: "exact", head: true })
      .in("employee_id", employeeIds);
    return count ?? 0;
  }

  const teamMemberIds = (teamId: string | null) =>
    employees.filter((e) => e.team_id === teamId).map((e) => e.id);

  // --- daily_activity scoping ---------------------------------------------
  console.log("daily_activity visibility\n");

  const employeeClient = await signInAs(plainEmployee.email);
  const { count: employeeCount } = await employeeClient
    .from("daily_activity")
    .select("id", { count: "exact", head: true });
  const expectedEmployeeRows = await activityRowCountFor([plainEmployee.id]);
  if (employeeCount === expectedEmployeeRows)
    pass(`employee sees exactly their own ${expectedEmployeeRows} activity row(s)`);
  else fail(`employee should see ${expectedEmployeeRows} row(s) (their own), saw ${employeeCount}`);

  const managerClient = await signInAs(manager.email);
  const { count: managerCount } = await managerClient
    .from("daily_activity")
    .select("id", { count: "exact", head: true });
  const expectedTeamRows = await activityRowCountFor(teamMemberIds(manager.team_id));
  if (managerCount === expectedTeamRows)
    pass(`manager sees exactly their team's ${expectedTeamRows} activity row(s)`);
  else fail(`manager should see ${expectedTeamRows} row(s) (their team), saw ${managerCount}`);

  const hrClient = await signInAs(hr.email);
  const { count: hrCount } = await hrClient
    .from("daily_activity")
    .select("id", { count: "exact", head: true });
  const expectedOrgRows = await activityRowCountFor(employees.map((e) => e.id));
  if (hrCount === expectedOrgRows)
    pass(`hr sees the whole org's ${expectedOrgRows} activity row(s)`);
  else fail(`hr should see all ${expectedOrgRows} row(s), saw ${hrCount}`);

  // --- kudos: flagged rows are hr-only ------------------------------------
  console.log("\nkudos visibility\n");

  const { count: flaggedTotal } = await admin
    .from("kudos")
    .select("id", { count: "exact", head: true })
    .eq("flagged", true);

  const { count: employeeFlaggedVisible } = await employeeClient
    .from("kudos")
    .select("id", { count: "exact", head: true })
    .eq("flagged", true);
  if (employeeFlaggedVisible === 0) pass("employee sees zero flagged kudos");
  else fail(`employee should see 0 flagged kudos, saw ${employeeFlaggedVisible}`);

  const { count: hrFlaggedVisible } = await hrClient
    .from("kudos")
    .select("id", { count: "exact", head: true })
    .eq("flagged", true);
  if (hrFlaggedVisible === flaggedTotal) pass(`hr sees all ${flaggedTotal} flagged kudos`);
  else fail(`hr should see ${flaggedTotal} flagged kudos, saw ${hrFlaggedVisible}`);

  // --- teams: writable only by hr ------------------------------------------
  console.log("\nteams write access\n");
  //
  // A blocked-by-RLS UPDATE is NOT an error in PostgREST — the WHERE clause
  // (implicitly ANDed with the RLS policy) just matches zero rows, and
  // Supabase reports that as a normal success with an empty result. Both
  // writes below set manager_id back to its own current value, so even a
  // "successful" write changes nothing either way; what actually proves the
  // policy is `count`/the returned row, not `error`.

  const { data: anyTeam } = await admin.from("teams").select("id, manager_id").limit(1).single();
  if (anyTeam) {
    const { data: employeeRows, count: employeeWriteCount } = await employeeClient
      .from("teams")
      .update({ manager_id: anyTeam.manager_id }, { count: "exact" })
      .eq("id", anyTeam.id)
      .select();
    if ((employeeWriteCount ?? 0) === 0 && (employeeRows?.length ?? 0) === 0)
      pass("employee's write matches zero rows — blocked by RLS");
    else fail(`employee's write should match 0 rows, matched ${employeeWriteCount}`);

    const { data: hrRows, count: hrWriteCount } = await hrClient
      .from("teams")
      .update({ manager_id: anyTeam.manager_id }, { count: "exact" })
      .eq("id", anyTeam.id)
      .select();
    if ((hrWriteCount ?? 0) === 1 && (hrRows?.length ?? 0) === 1)
      pass("hr's write matches the target row");
    else fail(`hr's write should match 1 row, matched ${hrWriteCount}`);
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
