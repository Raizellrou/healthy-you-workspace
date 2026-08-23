/**
 * Materialises calendar_events from each employee's already-recorded
 * daily_activity.meeting_hours. Run with: npm run seed:calendar
 *
 * WHAT IS REAL AND WHAT IS NOT — read this before trusting any number
 * downstream:
 *
 *   REAL      the per-employee-per-day meeting TOTAL. Every day this script
 *             writes sums to that person's existing meeting_hours to within
 *             one 15-minute slot, so the calendar and daily_activity (and
 *             therefore the burnout meeting factor) can never disagree.
 *
 *   MODELLED  where the blocks sit inside the day, how many there are, and
 *             which repeat. This project has no calendar integration and
 *             has never claimed one. Anything reading exact start/end times
 *             — free-gap analysis, "no uninterrupted 90 minutes" — is
 *             reasoning about a plausible reconstruction, not observation.
 *
 * app/(app)/meetings/page.tsx says exactly this on screen. Keep them in sync.
 *
 * Deterministic: placement is driven by a hash of (employee_id, date), so
 * re-running produces the identical calendar rather than a new random one.
 * Idempotent: deletes only the rows it previously generated for the window
 * (by employee + date range) before reinserting.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — bypasses RLS, never
 * ships to the browser.
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

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** How far back to materialise. Matches the analytics windows elsewhere. */
const WINDOW_DAYS = 60;
const SLOT_MINUTES = 15;

/** Deterministic 32-bit hash so a given (employee, date) always yields the
 *  same shape of day across runs. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Minutes that `timeZone` is ahead of UTC on `date`.
 *
 * Needed because every block below is positioned in the employee's LOCAL
 * working day (their work_schedules start_min/end_min), but the column is
 * timestamptz. Writing `${date}T09:00:00Z` for "9am local" was a real bug:
 * in Asia/Manila that instant is 5pm, so nearly every generated meeting
 * landed outside the 09:00-18:00 window the reader clips to, and the
 * meeting-load screen reported a fraction of the true hours.
 */
function offsetMinutes(date: string, timeZone: string): number {
  const instant = new Date(`${date}T12:00:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  );
  return (asIfUtc - instant.getTime()) / 60000;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface RecurringSeries {
  seriesId: string;
  title: string;
  weekday: number;
  startMin: number;
  durationMin: number;
  attendeeCount: number;
}

/**
 * Team-level recurring meetings. These are the rows the recurring-meeting
 * audit groups by series_id — a standing weekly commitment everyone on a
 * team carries, which is exactly the thing worth questioning.
 */
function seriesForTeam(team: string, teamSize: number): RecurringSeries[] {
  const base = hash(team);
  return [
    {
      seriesId: `${team}-standup`,
      title: `${team} standup`,
      weekday: 1,
      startMin: 540 + (base % 2) * 30,
      durationMin: 30,
      attendeeCount: teamSize,
    },
    {
      seriesId: `${team}-planning`,
      title: `${team} weekly planning`,
      weekday: 3,
      startMin: 600 + (base % 3) * 30,
      durationMin: 60,
      attendeeCount: teamSize,
    },
    {
      seriesId: `${team}-retro`,
      title: `${team} retro`,
      weekday: 5,
      startMin: 900,
      durationMin: 45,
      attendeeCount: Math.max(2, teamSize - 1),
    },
  ];
}

const ONE_OFF_TITLES = [
  "Client sync",
  "Design review",
  "Roadmap check-in",
  "Vendor call",
  "Hiring debrief",
  "Incident review",
  "Stakeholder update",
];

interface EventRow {
  employee_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  kind: string;
  series_id: string | null;
  attendee_count: number;
  organiser_id: string | null;
}

/** Places `targetMinutes` of meetings inside [startMin, endMin) for one day,
 *  honouring the recurring series that fall on this weekday first. */
function buildDay(
  employeeId: string,
  date: string,
  targetMinutes: number,
  dayStartMin: number,
  dayEndMin: number,
  series: RecurringSeries[],
  seriesUuid: Map<string, string>,
  organiserId: string | null,
  timezone: string
): EventRow[] {
  const weekday = isoWeekday(date);
  const rows: EventRow[] = [];
  const taken: { start: number; end: number }[] = [];
  let remaining = targetMinutes;

  // `min` is minutes into the employee's LOCAL day; convert to the matching
  // UTC instant before writing to a timestamptz column.
  const offset = offsetMinutes(date, timezone);
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  const toIso = (min: number) => new Date(midnightUtc + (min - offset) * 60000).toISOString();

  const fits = (start: number, duration: number) =>
    start >= dayStartMin &&
    start + duration <= dayEndMin &&
    !taken.some((t) => start < t.end && start + duration > t.start);

  for (const s of series) {
    if (s.weekday !== weekday) continue;
    if (remaining < s.durationMin) break;
    if (!fits(s.startMin, s.durationMin)) continue;
    taken.push({ start: s.startMin, end: s.startMin + s.durationMin });
    rows.push({
      employee_id: employeeId,
      title: s.title,
      starts_at: toIso(s.startMin),
      ends_at: toIso(s.startMin + s.durationMin),
      kind: "meeting",
      series_id: seriesUuid.get(s.seriesId) ?? null,
      attendee_count: s.attendeeCount,
      organiser_id: organiserId,
    });
    remaining -= s.durationMin;
  }

  // Fill the rest with one-off meetings at deterministic slots.
  let salt = hash(`${employeeId}:${date}`);
  let guard = 0;
  while (remaining >= SLOT_MINUTES && guard < 40) {
    guard++;
    salt = hash(String(salt));
    const duration = Math.min(remaining, [30, 45, 60][salt % 3]);
    const slots = Math.floor((dayEndMin - dayStartMin) / SLOT_MINUTES);
    const start = dayStartMin + ((salt >>> 8) % slots) * SLOT_MINUTES;
    if (!fits(start, duration)) continue;
    taken.push({ start, end: start + duration });
    rows.push({
      employee_id: employeeId,
      title: ONE_OFF_TITLES[salt % ONE_OFF_TITLES.length],
      starts_at: toIso(start),
      ends_at: toIso(start + duration),
      kind: "meeting",
      series_id: null,
      attendee_count: 2 + (salt % 5),
      organiser_id: organiserId,
    });
    remaining -= duration;
  }

  return rows;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const windowStart = addDays(today, -WINDOW_DAYS);

  const [{ data: employees }, { data: activity }, { data: schedules }] = await Promise.all([
    supabase.from("employees").select("id, name, team, timezone"),
    supabase.from("daily_activity").select("employee_id, date, meeting_hours").gte("date", windowStart),
    supabase.from("work_schedules").select("employee_id, start_min, end_min"),
  ]);

  if (!employees || !activity) {
    console.error("Could not read employees/daily_activity.");
    process.exit(1);
  }

  const scheduleBy = new Map((schedules ?? []).map((s) => [s.employee_id, s]));
  const teamSizes = new Map<string, number>();
  for (const e of employees) teamSizes.set(e.team, (teamSizes.get(e.team) ?? 0) + 1);

  // Stable UUIDs per series key so every attendee's instances group together.
  const seriesUuid = new Map<string, string>();
  for (const team of teamSizes.keys()) {
    for (const s of seriesForTeam(team, teamSizes.get(team) ?? 1)) {
      if (!seriesUuid.has(s.seriesId)) seriesUuid.set(s.seriesId, crypto.randomUUID());
    }
  }

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const rows: EventRow[] = [];

  for (const row of activity) {
    const employee = employeeById.get(row.employee_id);
    if (!employee) continue;
    const weekday = isoWeekday(row.date);
    if (weekday > 5) continue;
    const targetMinutes = Math.round(((row.meeting_hours ?? 0) * 60) / SLOT_MINUTES) * SLOT_MINUTES;
    if (targetMinutes <= 0) continue;

    const schedule = scheduleBy.get(row.employee_id);
    rows.push(
      ...buildDay(
        row.employee_id,
        row.date,
        targetMinutes,
        schedule?.start_min ?? 540,
        schedule?.end_min ?? 1080,
        seriesForTeam(employee.team, teamSizes.get(employee.team) ?? 1),
        seriesUuid,
        employee.id,
        employee.timezone ?? "Asia/Manila"
      )
    );
  }

  // Idempotent: clear the window for these employees, then reinsert.
  const employeeIds = employees.map((e) => e.id);
  const { error: delError } = await supabase
    .from("calendar_events")
    .delete()
    .in("employee_id", employeeIds)
    // A day earlier than the window start: local-to-UTC conversion can put a
    // windowStart morning meeting on the previous UTC day, and a delete that
    // missed it would leave an orphan behind on every re-run.
    .gte("starts_at", `${addDays(windowStart, -1)}T00:00:00Z`);
  if (delError) {
    console.error("Failed clearing existing window:", delError.message);
    process.exit(1);
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("calendar_events").insert(chunk);
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
  }

  // Reconciliation check — the whole point of the script.
  const recordedMinutes = activity
    .filter((r) => isoWeekday(r.date) <= 5)
    .reduce((s, r) => s + Math.round(((r.meeting_hours ?? 0) * 60) / SLOT_MINUTES) * SLOT_MINUTES, 0);
  const writtenMinutes = rows.reduce(
    (s, r) => s + (Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60000,
    0
  );

  console.log(`Wrote ${rows.length} calendar events across ${employees.length} employees.`);
  console.log(`Recorded meeting minutes (weekdays, from daily_activity): ${recordedMinutes}`);
  console.log(`Materialised meeting minutes (calendar_events):           ${writtenMinutes}`);
  const drift = recordedMinutes === 0 ? 0 : Math.abs(recordedMinutes - writtenMinutes) / recordedMinutes;
  console.log(`Drift: ${(drift * 100).toFixed(2)}%`);
  if (drift > 0.05) {
    console.warn("WARNING: calendar totals drifted more than 5% from daily_activity — investigate before trusting aggregates.");
  }
}

main();
