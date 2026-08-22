import { createClient } from "@/lib/supabase/server";
import type { AppRole, Person, Team } from "@/types/person";

/**
 * Role-aware queries for teams/app_role/scoped visibility (0009/0010).
 * Sibling to the frozen `lib/supabase/queries.ts` — that file's `select()`
 * column lists are hardcoded, so `app_role`/`team_id`/`timezone`/
 * `weekly_capacity_hours` will never surface through it. This module reads
 * only the new columns/table; it never duplicates a query `queries.ts`
 * already owns.
 *
 * Every read here is subject to RLS: `getVisibleEmployees()` returns
 * whatever `can_see_employee()` allows for the signed-in session, which is
 * the actual security boundary — this module doesn't second-guess it.
 */

interface PersonRow {
  id: string;
  name: string;
  email: string;
  team: string;
  team_id: string | null;
  app_role: AppRole;
  timezone: string;
  weekly_capacity_hours: number;
}

const AVATAR_PALETTE = [
  "#0ea5e9",
  "#0369a1",
  "#7c3aed",
  "#0d9488",
  "#c026d3",
  "#4338ca",
  "#0891b2",
  "#9333ea",
] as const;

function toPerson(row: PersonRow, index: number): Person {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    team: row.team,
    teamId: row.team_id,
    appRole: row.app_role,
    timezone: row.timezone,
    weeklyCapacityHours: row.weekly_capacity_hours,
    avatarColor: AVATAR_PALETTE[index % AVATAR_PALETTE.length],
  };
}

const PERSON_COLUMNS =
  "id, name, email, team, team_id, app_role, timezone, weekly_capacity_hours";

/**
 * The signed-in user's own role-aware record, or null if there isn't a
 * session or a matching employee row. This is the one place `app_role`
 * gets resolved for gating nav/screens — everything downstream (RoleGate,
 * the Sidebar's role badge, the Teams screen) takes it as a prop rather
 * than re-querying.
 */
export async function getCurrentPerson(): Promise<Person | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("employees")
    .select(PERSON_COLUMNS)
    .eq("auth_user_id", user.id)
    .single<PersonRow>();

  if (error || !data) return null;
  return toPerson(data, 0);
}

/**
 * Every employee the signed-in session's RLS policy allows — self-only,
 * team, or org, depending on role. Ordering by name gives a stable index
 * for avatar color assignment, matching the frozen `getEmployees()`'s
 * convention so the same person's color doesn't shift between the two
 * query paths.
 */
export async function getVisibleEmployees(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(PERSON_COLUMNS)
    .order("name")
    .returns<PersonRow[]>();

  if (error) {
    throw new Error(`Failed to load employees: ${error.message}`);
  }
  return (data ?? []).map(toPerson);
}

interface TeamRow {
  id: string;
  name: string;
  manager_id: string | null;
  employees: { name: string } | null;
}

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, manager_id, employees:manager_id(name)")
    .order("name")
    .returns<TeamRow[]>();

  if (error) {
    throw new Error(`Failed to load teams: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    managerId: row.manager_id,
    managerName: row.employees?.name ?? null,
  }));
}

export async function getTeamMembers(teamId: string): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(PERSON_COLUMNS)
    .eq("team_id", teamId)
    .order("name")
    .returns<PersonRow[]>();

  if (error) {
    throw new Error(`Failed to load team members: ${error.message}`);
  }
  return (data ?? []).map(toPerson);
}
