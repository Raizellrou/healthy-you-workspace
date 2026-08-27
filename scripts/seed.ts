/**
 * One-time seed script: creates a real Supabase Auth user (email confirmed,
 * password auth) for each existing row in the `employees` table, and links
 * it back via `employees.auth_user_id`. Run with: npm run seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — this key bypasses RLS
 * and must never be shipped to the browser. Safe to re-run: already-linked
 * employees are skipped.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DEMO_PASSWORD = "petal-demo-2026";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  auth_user_id: string | null;
}

async function seed() {
  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, email, auth_user_id")
    .returns<EmployeeRow[]>();

  if (error) {
    console.error("Failed to fetch employees:", error.message);
    process.exit(1);
  }

  console.log(`Seeding auth users for ${employees.length} employees...\n`);

  for (const employee of employees) {
    if (employee.auth_user_id) {
      console.log(`- ${employee.name}: already linked, skipping`);
      continue;
    }

    const { data, error: createError } = await supabase.auth.admin.createUser({
      email: employee.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    if (createError) {
      console.error(`✗ ${employee.name} (${employee.email}): ${createError.message}`);
      continue;
    }

    const { error: linkError } = await supabase
      .from("employees")
      .update({ auth_user_id: data.user.id })
      .eq("id", employee.id);

    if (linkError) {
      console.error(`✗ ${employee.name}: auth user created but link failed: ${linkError.message}`);
      continue;
    }

    console.log(`✓ ${employee.name} (${employee.email})`);
  }

  console.log(`\nDone. Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
  console.log("This is a shared demo password for local/internal exploration only — do not reuse it anywhere real.");
}

seed();
