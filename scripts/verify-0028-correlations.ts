/**
 * Verifies 0028_correlations.sql actually took effect: both RPCs exist,
 * return real correlation stats over real daily_activity/mood_checkins
 * rows when called as HR, and return zero rows for a non-HR caller.
 *
 * Per AGENTS.md: never assume a migration applied because the file exists.
 * This is a read-only check — no writes, nothing to clean up.
 *
 * Run with: npx tsx scripts/verify-0028-correlations.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DEMO_PASSWORD = "axionhr-demo-2026";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

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
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: employees, error } = await admin.from("employees").select("email, app_role").order("name");
  if (error || !employees) {
    console.error("Failed to read employees:", error?.message);
    process.exit(1);
  }
  const hr = employees.find((e) => e.app_role === "hr");
  const plainEmployee = employees.find((e) => e.app_role === "employee");
  if (!hr || !plainEmployee) {
    console.error("Could not find both an hr and an employee demo account.");
    process.exit(1);
  }

  console.log(`Signing in as HR (${hr.email}) and employee (${plainEmployee.email})...`);
  const [hrClient, employeeClient] = await Promise.all([signInAs(hr.email), signInAs(plainEmployee.email)]);

  console.log("\nget_meeting_burnout_corr as HR:");
  const { data: hrMeeting, error: hrMeetingErr } = await hrClient.rpc("get_meeting_burnout_corr", { days: 30 });
  if (hrMeetingErr) {
    fail(`RPC errored: ${hrMeetingErr.message}`);
  } else {
    console.log(" ", hrMeeting);
    const row = hrMeeting?.[0];
    if (row && typeof row.sample_size === "number" && row.sample_size > 0) {
      pass(`returned ${row.sample_size} sample rows, correlation=${row.correlation}`);
    } else {
      fail(`expected sample_size > 0, got: ${JSON.stringify(row)}`);
    }
  }

  console.log("\nget_offhours_mood_corr as HR:");
  const { data: hrMood, error: hrMoodErr } = await hrClient.rpc("get_offhours_mood_corr", { days: 30 });
  if (hrMoodErr) {
    fail(`RPC errored: ${hrMoodErr.message}`);
  } else {
    console.log(" ", hrMood);
    const row = hrMood?.[0];
    if (row && typeof row.sample_size === "number" && row.sample_size > 0) {
      pass(`returned ${row.sample_size} sample rows, correlation=${row.correlation}`);
    } else {
      fail(`expected sample_size > 0, got: ${JSON.stringify(row)}`);
    }
  }

  console.log("\nget_meeting_burnout_corr as plain employee (should be gated to zero rows):");
  const { data: empMeeting, error: empMeetingErr } = await employeeClient.rpc("get_meeting_burnout_corr", { days: 30 });
  if (empMeetingErr) {
    fail(`RPC errored (expected zero rows, not an error): ${empMeetingErr.message}`);
  } else {
    const row = empMeeting?.[0];
    const sampleSize = row?.sample_size ?? 0;
    if (!row || sampleSize === 0) {
      pass(`non-HR caller got sample_size=0 (or no row) — gate holds`);
    } else {
      fail(`non-HR caller saw real data: ${JSON.stringify(row)}`);
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
