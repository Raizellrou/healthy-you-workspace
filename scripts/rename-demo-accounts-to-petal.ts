/**
 * One-time migration: renames every existing demo account's Supabase Auth
 * identity from the old AxionHR naming to Petal — email domain
 * @axionhr.test -> @petal.test, and password axionhr-demo-2026 ->
 * petal-demo-2026 (matching DEMO_PASSWORD in the seed scripts).
 *
 * Scope: every write below targets a specific row by id, read from the real
 * `employees` table moments before — no unscoped UPDATE. Only rows whose
 * current email ends in @axionhr.test and that already have an
 * auth_user_id are touched; everything else is left alone.
 *
 * This updates:
 *   1. The Supabase Auth user's email + password (auth.admin.updateUserById)
 *   2. employees.email, so it matches the new auth email (seed-org.ts's
 *      idempotency check matches by this column)
 *
 * Per AGENTS.md: this writes to live hosted auth data. Do not run without
 * explicit confirmation — read through the plan below first.
 *
 * Run with: npx tsx scripts/rename-demo-accounts-to-petal.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const OLD_DOMAIN = "@axionhr.test";
const NEW_DOMAIN = "@petal.test";
const NEW_PASSWORD = "petal-demo-2026";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  auth_user_id: string | null;
}

async function main() {
  const { data: employees, error } = await admin
    .from("employees")
    .select("id, name, email, auth_user_id")
    .returns<EmployeeRow[]>();
  if (error || !employees) {
    console.error("Failed to read employees:", error?.message);
    process.exit(1);
  }

  const targets = employees.filter((e) => e.auth_user_id && e.email.endsWith(OLD_DOMAIN));
  const skipped = employees.filter((e) => !e.auth_user_id || !e.email.endsWith(OLD_DOMAIN));

  console.log(`${employees.length} employees total. ${targets.length} to migrate, ${skipped.length} skipped (no auth_user_id, or already off ${OLD_DOMAIN}).\n`);

  let succeeded = 0;
  let failed = 0;

  for (const employee of targets) {
    const newEmail = employee.email.replace(OLD_DOMAIN, NEW_DOMAIN);

    const { error: authError } = await admin.auth.admin.updateUserById(employee.auth_user_id!, {
      email: newEmail,
      password: NEW_PASSWORD,
      email_confirm: true,
    });
    if (authError) {
      console.error(`✗ ${employee.name}: auth update failed: ${authError.message}`);
      failed++;
      continue;
    }

    const { error: rowError } = await admin
      .from("employees")
      .update({ email: newEmail })
      .eq("id", employee.id);
    if (rowError) {
      console.error(`✗ ${employee.name}: auth email changed to ${newEmail} but employees.email update failed: ${rowError.message} — accounts are now out of sync, fix manually`);
      failed++;
      continue;
    }

    console.log(`✓ ${employee.name}: ${employee.email} -> ${newEmail}`);
    succeeded++;
  }

  console.log(`\nDone. ${succeeded} migrated, ${failed} failed, ${skipped.length} skipped.`);
  if (failed > 0) process.exit(1);
}

main();
