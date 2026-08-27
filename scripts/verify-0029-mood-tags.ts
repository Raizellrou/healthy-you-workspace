/**
 * Verifies 0029_mood_tags.sql actually took effect: mood_checkins.tags
 * exists, defaults to '{}', and accepts/reads back a text[] value.
 *
 * Per AGENTS.md: never assume a migration applied because the file exists.
 * The insert here uses a date far in the future so it can't collide with
 * the (employee_id, date) unique constraint on a real check-in; the row
 * is deleted immediately after.
 *
 * Run with: npx tsx scripts/verify-0029-mood-tags.ts
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

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
const pass = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  console.log(`  ✗ ${msg}`);
  failures++;
};

const PROBE_DATE = "2099-01-01";

async function main() {
  const { data: employees, error } = await admin.from("employees").select("id").limit(1);
  if (error || !employees?.[0]) {
    console.error("Failed to read an employee id:", error?.message);
    process.exit(1);
  }
  const employeeId = employees[0].id;
  let insertedId: string | null = null;

  try {
    console.log("Inserting a probe check-in with no tags, checking default...");
    const { data: inserted, error: insertError } = await admin
      .from("mood_checkins")
      .insert({ employee_id: employeeId, date: PROBE_DATE, mood_value: 3 })
      .select("id, tags")
      .single();
    if (insertError || !inserted) {
      fail(`insert failed: ${insertError?.message}`);
    } else {
      insertedId = inserted.id;
      if (Array.isArray(inserted.tags) && inserted.tags.length === 0) {
        pass(`tags defaulted to '{}': ${JSON.stringify(inserted.tags)}`);
      } else {
        fail(`expected tags='{}' by default, got: ${JSON.stringify(inserted.tags)}`);
      }

      console.log("Updating tags, verifying the write actually lands (re-select, not just absence of error)...");
      const { error: updateError } = await admin
        .from("mood_checkins")
        .update({ tags: ["workload", "sleep"] })
        .eq("id", insertedId);
      if (updateError) {
        fail(`update failed: ${updateError.message}`);
      } else {
        const { data: reselected, error: reselectError } = await admin
          .from("mood_checkins")
          .select("tags")
          .eq("id", insertedId)
          .single();
        if (reselectError || !reselected) {
          fail(`re-select failed: ${reselectError?.message}`);
        } else if (JSON.stringify(reselected.tags) === JSON.stringify(["workload", "sleep"])) {
          pass(`tags write landed: ${JSON.stringify(reselected.tags)}`);
        } else {
          fail(`expected tags=["workload","sleep"], got: ${JSON.stringify(reselected.tags)}`);
        }
      }
    }
  } finally {
    if (insertedId) {
      const { error: deleteError } = await admin.from("mood_checkins").delete().eq("id", insertedId);
      if (deleteError) {
        console.error(`Cleanup failed — test row ${insertedId} left in mood_checkins:`, deleteError.message);
      } else {
        console.log("Cleaned up test row.");
      }
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
