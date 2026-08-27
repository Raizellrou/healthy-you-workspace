/**
 * Verifies 0027_realtime_notifications.sql actually took effect: the
 * `notifications` table is in the supabase_realtime publication, and the
 * three previously-rejected kinds (intervention_suggested,
 * one_on_one_scheduled, coffee_proposed) now pass notifications_kind_check.
 *
 * Per AGENTS.md: never assume a migration applied because the file exists.
 * Every insert here is scoped to a row this script creates and deletes
 * itself; nothing is left behind and no existing row is touched.
 *
 * Run with: npx tsx scripts/verify-0027-realtime.ts
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

const NEW_KINDS = ["intervention_suggested", "one_on_one_scheduled", "coffee_proposed"] as const;

async function main() {
  const { data: employees, error } = await admin.from("employees").select("id").limit(1);
  if (error || !employees?.[0]) {
    console.error("Failed to read an employee id:", error?.message);
    process.exit(1);
  }
  const recipientId = employees[0].id;
  const insertedIds: string[] = [];

  try {
    console.log("Checking notifications_kind_check accepts the three previously-rejected kinds...");
    for (const kind of NEW_KINDS) {
      const { data, error } = await admin
        .from("notifications")
        .insert({ recipient_id: recipientId, actor_id: null, kind, title: "verify-0027 test row" })
        .select("id")
        .single();
      if (error) {
        fail(`insert with kind='${kind}' rejected: ${error.message}`);
      } else {
        pass(`kind='${kind}' accepted`);
        insertedIds.push(data.id);
      }
    }

    console.log("Checking public.notifications is in the supabase_realtime publication...");
    let sawEvent = false;
    const channel = admin
      .channel("verify-0027")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${recipientId}` },
        () => {
          sawEvent = true;
        }
      );
    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status, err) => {
        console.log(`  channel status: ${status}${err ? ` (${err.message})` : ""}`);
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
    });

    const { data: probe, error: probeError } = await admin
      .from("notifications")
      .insert({ recipient_id: recipientId, actor_id: null, kind: "due_soon", title: "verify-0027 realtime probe" })
      .select("id")
      .single();
    if (probeError || !probe) {
      fail(`probe insert failed: ${probeError?.message}`);
    } else {
      insertedIds.push(probe.id);
      await new Promise((r) => setTimeout(r, 6000));
      if (sawEvent) {
        pass("realtime INSERT event received — publication is active");
      } else {
        fail("no realtime event received within 3s — table is likely not in supabase_realtime publication");
      }
    }
    await admin.removeChannel(channel);
  } finally {
    if (insertedIds.length > 0) {
      const { error: deleteError } = await admin.from("notifications").delete().in("id", insertedIds);
      if (deleteError) {
        console.error(`Cleanup failed — ${insertedIds.length} test row(s) left in notifications:`, deleteError.message);
        console.error("Row ids:", insertedIds.join(", "));
      } else {
        console.log(`Cleaned up ${insertedIds.length} test row(s).`);
      }
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
