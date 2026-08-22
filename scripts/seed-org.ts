/**
 * Full demo dataset: 24 employees across 4 teams, each linked to a real
 * Supabase Auth user, plus 90 days of daily_activity per employee. Run with:
 * npm run seed:org
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — this key bypasses RLS
 * and must never be shipped to the browser.
 *
 * Idempotent, application-level (matching scripts/seed.ts's own style,
 * rather than a DB-level upsert): existing employees are matched by email
 * and left alone; auth users are only created for employees that don't
 * already have auth_user_id set; daily_activity rows are only inserted for
 * (employee_id, date) pairs that don't already exist. Safe to re-run.
 *
 * The burnout distribution is deliberately shaped, not random — an all-green
 * dashboard demos nothing. Composite scores below are computed with the
 * real, frozen `computeBurnout` from lib/burnout.ts (imported, not
 * reimplemented) so the shape is verified against the actual scoring
 * function, not a guess at what it does.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { computeBurnout, bandFor } from "../lib/burnout";

config({ path: ".env.local" });

const DEMO_PASSWORD = "axionhr-demo-2026";
const HISTORY_DAYS = 90;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Avatar colors aren't stored — lib/supabase/queries.ts computes them
// client-side by roster index at read time, so the seed doesn't set any.

type Team = "Engineering" | "Design" | "Sales" | "Support";
type Persona = "critical" | "high" | "ptoNow" | "longStreak" | "scattered";

interface RosterEntry {
  name: string;
  team: Team;
  role: string;
  persona: Persona;
}

function emailFor(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ".") + "@axionhr.test";
}

// 24 people, 6 per team. The first 8 are the original lib/employees.ts cast;
// the rest are new, expanding the roster without renaming anyone already
// referenced elsewhere (login demo accounts, old fixtures).
const ROSTER: RosterEntry[] = [
  { name: "Amara Adeyemi", team: "Engineering", role: "Software Engineer", persona: "scattered" },
  { name: "Beatriz Haddad", team: "Design", role: "Product Designer", persona: "scattered" },
  { name: "Healthy Hannah", team: "Engineering", role: "Senior Engineer", persona: "scattered" },
  { name: "Warning Will", team: "Design", role: "Design Lead", persona: "high" },
  { name: "Risky Rita", team: "Sales", role: "Account Executive", persona: "critical" },
  { name: "Burnout Bob", team: "Support", role: "Support Specialist", persona: "scattered" },
  { name: "Caleb Okafor", team: "Sales", role: "SDR", persona: "high" },
  { name: "Dhruv Bianchi", team: "Support", role: "Support Lead", persona: "ptoNow" },

  { name: "Priya Shenoy", team: "Engineering", role: "Backend Engineer", persona: "critical" },
  { name: "Sofia Marchetti", team: "Engineering", role: "Engineering Manager", persona: "longStreak" },
  { name: "Noah Fitzgerald", team: "Support", role: "Support Specialist", persona: "high" },
  { name: "Lena Kowalski", team: "Engineering", role: "QA Engineer", persona: "scattered" },

  { name: "Tobias Reinholt", team: "Design", role: "UX Researcher", persona: "scattered" },
  { name: "Ingrid Solberg", team: "Design", role: "Product Designer", persona: "scattered" },
  { name: "Marcus Webb", team: "Design", role: "Visual Designer", persona: "scattered" },
  { name: "Yuki Tanaka", team: "Design", role: "Design Systems Lead", persona: "scattered" },

  { name: "Diego Fernandez", team: "Sales", role: "Account Executive", persona: "scattered" },
  { name: "Chidinma Eze", team: "Sales", role: "SDR", persona: "scattered" },
  { name: "Hana Kimura", team: "Sales", role: "Sales Manager", persona: "scattered" },
  { name: "Owen Bright", team: "Sales", role: "Account Executive", persona: "scattered" },

  { name: "Farah Haidari", team: "Support", role: "Support Specialist", persona: "scattered" },
  { name: "Callum Ashworth", team: "Support", role: "Support Specialist", persona: "scattered" },
  { name: "Renata Silva", team: "Support", role: "Support Lead", persona: "scattered" },
  { name: "Jonas Berg", team: "Support", role: "Support Specialist", persona: "scattered" },
];

interface ActivityRow {
  employee_id: string;
  date: string;
  meeting_hours: number;
  available_hours: number;
  off_hours_messages: number;
  worked_today: boolean;
  on_pto: boolean;
}

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Deterministic per-employee pseudo-random in [0, 1), so reruns before any
 *  rows exist would reproduce the same shape. Not cryptographic — just a
 *  seeded generator so "scattered" isn't 17 identical rows. */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface ActivityProfile {
  streakDays: number;
  meetingHours: number;
  availableHours: number;
  offHoursMessages: number;
  ptoNow?: boolean;
}

/**
 * Builds `HISTORY_DAYS` rows, most-recent-first in generation order (day 0
 * = today). Values are constant across the window except for the flags that
 * shape streak/PTO, so the result matches straightforward hand computation
 * against `deriveStats` in lib/supabase/queries.ts:
 *   - `meetingAvg` is the mean of `meeting_hours` over the whole window
 *   - `offHoursWeekly` is the sum of `off_hours_messages` over the last 7 rows
 *   - `streakDays` counts consecutive `worked_today && !on_pto` rows from
 *     the most recent day back to the first gap
 *   - `daysSincePto` is the index of the most recent `on_pto` row, or the
 *     window length if there isn't one
 * A single "gap" day (worked_today = false, everything else zeroed) is
 * placed right after the target streak length to cap it there. Every gap
 * day used here sits at index >= 8 for the shaped personas, which is
 * outside the trailing-7-day window `offHoursWeekly` reads — so it only
 * ever nudges `meetingAvg` by a fraction of a point, never the weekly sum.
 */
function buildActivityRows(employeeId: string, profile: ActivityProfile): ActivityRow[] {
  const rows: ActivityRow[] = [];

  if (profile.ptoNow) {
    // A PTO week: this week off, ordinary moderate work before that.
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const onPtoDay = i < 7;
      rows.push({
        employee_id: employeeId,
        date: isoDate(i),
        meeting_hours: onPtoDay ? 0 : 2,
        available_hours: profile.availableHours,
        off_hours_messages: onPtoDay ? 0 : 1,
        worked_today: !onPtoDay,
        on_pto: onPtoDay,
      });
    }
    return rows;
  }

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const isGapDay = i === profile.streakDays;
    rows.push({
      employee_id: employeeId,
      date: isoDate(i),
      meeting_hours: isGapDay ? 0 : profile.meetingHours,
      available_hours: profile.availableHours,
      // off_hours_messages is an integer column — "scattered" generates a
      // float, and the fractional persona constants above (1.3, 1.4) would
      // fail the same way, so round at the single point every row is built.
      off_hours_messages: isGapDay ? 0 : Math.round(profile.offHoursMessages),
      worked_today: !isGapDay,
      on_pto: false,
    });
  }
  return rows;
}

// Values below were checked against the real computeBurnout() before being
// committed here (see the composite/band comments) so the shaped bands are
// verified, not asserted. All streaks for the "critical"/"high" personas
// stay under 21 so Sofia Marchetti's streak remains the longest in the org.
function profileFor(persona: Persona, seedIndex: number): ActivityProfile {
  switch (persona) {
    case "critical": {
      // Two variants so the two critical employees aren't identical rows.
      const variant = seedIndex % 2 === 0
        ? { streakDays: 16, meetingHours: 6.5, availableHours: 7, offHoursMessages: 2 } // composite ~81.5
        : { streakDays: 18, meetingHours: 7, availableHours: 8, offHoursMessages: 2 };  // composite ~78.5
      return variant;
    }
    case "high": {
      const variants = [
        { streakDays: 9, meetingHours: 5, availableHours: 8, offHoursMessages: 1.3 },   // ~57
        { streakDays: 11, meetingHours: 5.5, availableHours: 8, offHoursMessages: 1.4 }, // ~65
        { streakDays: 8, meetingHours: 5, availableHours: 7, offHoursMessages: 1.3 },    // ~57
      ];
      return variants[seedIndex % variants.length];
    }
    case "longStreak":
      // 21 consecutive days, but light otherwise — composite ~40 (medium),
      // a deliberate contrast: a long streak alone isn't what drives the
      // score into high/critical territory.
      return { streakDays: 21, meetingHours: 1.5, availableHours: 8, offHoursMessages: 0 };
    case "ptoNow":
      return { streakDays: 0, meetingHours: 0, availableHours: 8, offHoursMessages: 0, ptoNow: true };
    case "scattered": {
      const rand = seededRandom(1000 + seedIndex);
      return {
        streakDays: Math.floor(rand() * 7), // 0-6
        meetingHours: 1 + rand() * 2.5, // 1-3.5
        availableHours: 7 + Math.round(rand()), // 7 or 8
        offHoursMessages: rand() * 6, // 0-6
      };
    }
  }
}

interface ExistingEmployee {
  id: string;
  email: string;
  auth_user_id: string | null;
}

async function main() {
  console.log(`Seeding ${ROSTER.length} employees across 4 teams...\n`);

  const { data: existingRows, error: existingErr } = await supabase
    .from("employees")
    .select("id, email, auth_user_id")
    .returns<ExistingEmployee[]>();
  if (existingErr) {
    console.error("Failed to read existing employees:", existingErr.message);
    process.exit(1);
  }
  const existingByEmail = new Map((existingRows ?? []).map((e) => [e.email, e]));

  const toInsert = ROSTER.filter((r) => !existingByEmail.has(emailFor(r.name))).map((r) => ({
    name: r.name,
    team: r.team,
    role: r.role,
    email: emailFor(r.name),
  }));

  // Guards against exactly what happened the first time this ran: matching
  // ROSTER by email only tells you which of THESE names already exist, not
  // whether the org is already at capacity under different names. It was —
  // 24 real people already existed (from a July seed lib/employees.ts never
  // reflected — that fixture is stale, see AGENTS.md), so 8 ROSTER names
  // matched and this script happily invented 16 more, taking the org to 40.
  // If the org is already full-sized and some ROSTER names don't match,
  // that's a sign this ROSTER doesn't describe the current org — stop
  // instead of padding it further.
  if (toInsert.length > 0 && (existingRows?.length ?? 0) >= ROSTER.length) {
    console.error(
      `Refusing to insert ${toInsert.length} new employee(s): the org already has ` +
        `${existingRows?.length} people, at or above ROSTER's ${ROSTER.length}. ` +
        `${toInsert.length} ROSTER name(s) didn't match by email, which means this ` +
        `ROSTER doesn't describe who's actually there — not that seats are open. ` +
        `Check the real roster (npm run introspect, or query employees directly) ` +
        `before editing ROSTER to match reality.`
    );
    process.exit(1);
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from("employees")
      .insert(toInsert)
      .select("id, email, auth_user_id");
    if (insertErr) {
      console.error("Failed to insert new employees:", insertErr.message);
      process.exit(1);
    }
    for (const row of inserted ?? []) existingByEmail.set(row.email, row);
    console.log(`Inserted ${toInsert.length} new employee row(s).`);
  } else {
    console.log("All 24 employees already exist — skipping insert.");
  }

  // --- auth users -----------------------------------------------------
  let authCreated = 0;
  for (const entry of ROSTER) {
    const email = emailFor(entry.name);
    const existing = existingByEmail.get(email);
    if (!existing) continue; // shouldn't happen — just inserted or already there
    if (existing.auth_user_id) continue;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      console.error(`✗ auth user for ${entry.name}: ${error.message}`);
      continue;
    }

    const { error: linkErr } = await supabase
      .from("employees")
      .update({ auth_user_id: data.user.id })
      .eq("id", existing.id);
    if (linkErr) {
      console.error(`✗ ${entry.name}: auth user created but link failed: ${linkErr.message}`);
      continue;
    }
    existing.auth_user_id = data.user.id;
    authCreated++;
  }
  console.log(`Linked ${authCreated} new auth user(s) (existing links left untouched).\n`);

  // --- daily_activity ---------------------------------------------------
  const oldestDate = isoDate(HISTORY_DAYS - 1);
  const targetIds = ROSTER.map((r) => existingByEmail.get(emailFor(r.name))!.id);

  const { data: existingActivity, error: activityErr } = await supabase
    .from("daily_activity")
    .select("employee_id, date")
    .in("employee_id", targetIds)
    .gte("date", oldestDate);
  if (activityErr) {
    console.error("Failed to read existing daily_activity:", activityErr.message);
    process.exit(1);
  }
  const existingActivityKeys = new Set(
    (existingActivity ?? []).map((r) => `${r.employee_id}|${r.date}`)
  );

  let rowsToInsert: ActivityRow[] = [];
  let seedIndex = 0;
  console.log("Predicted burnout band per persona (checked against computeBurnout):\n");

  for (const entry of ROSTER) {
    const employee = existingByEmail.get(emailFor(entry.name))!;
    const profile = profileFor(entry.persona, seedIndex);
    seedIndex++;

    const rows = buildActivityRows(employee.id, profile);
    const missing = rows.filter((r) => !existingActivityKeys.has(`${r.employee_id}|${r.date}`));
    rowsToInsert = rowsToInsert.concat(missing);

    if (entry.persona !== "scattered") {
      // Preview using the same window getEmployees() will actually fetch
      // (see the P1 cutoff added to lib/supabase/queries.ts): most recent
      // 30 rows, most-recent-first — matching deriveStats's own contract.
      const window = rows.slice(0, 30);
      const latest = window[0];
      let streakDays = 0;
      for (const r of window) {
        if (r.worked_today && !r.on_pto) streakDays++;
        else break;
      }
      let daysSincePto = window.length;
      for (let i = 0; i < window.length; i++) {
        if (window[i].on_pto) {
          daysSincePto = i;
          break;
        }
      }
      const meetingAvg = window.reduce((s, r) => s + r.meeting_hours, 0) / window.length;
      const offHoursWeekly = window.slice(0, 7).reduce((s, r) => s + r.off_hours_messages, 0);

      const scores = computeBurnout({
        streakDays,
        meetingAvg,
        available: latest.available_hours || 8,
        offHoursWeekly,
        daysSincePto,
        onPto: latest.on_pto,
      });
      console.log(
        `  ${entry.name.padEnd(20)} ${entry.persona.padEnd(11)} composite ${scores.composite.toFixed(1).padStart(5)}  ${bandFor(scores.composite)}`
      );
    }
  }

  console.log(`\nInserting ${rowsToInsert.length} new daily_activity row(s) (skipping already-existing dates)...`);

  const CHUNK = 500;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
    const chunk = rowsToInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("daily_activity").insert(chunk);
    if (error) {
      console.error(`Failed inserting rows ${i}-${i + chunk.length}: ${error.message}`);
      process.exit(1);
    }
  }

  const { count: employeeCount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true });
  const { count: activityCount } = await supabase
    .from("daily_activity")
    .select("id", { count: "exact", head: true });

  console.log(`\nDone. employees: ${employeeCount ?? "?"} · daily_activity: ${activityCount ?? "?"}`);
  console.log(`Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
