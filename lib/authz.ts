import type { AppRole, Person, Team } from "@/types/person";

/**
 * Pure mirror of the SQL policy logic in
 * supabase/migrations/0010_rls_v2.sql (can_see_employee / manages / is_hr) —
 * with one exception, canManageProjects, noted at its own definition below.
 *
 * This is UI gating only — hiding a nav link, disabling a control — not the
 * security boundary. RLS is the boundary; the database enforces visibility
 * regardless of what this returns. If this and the SQL ever disagree, the
 * failure mode is a UI glitch (something shown that a later fetch 403s on,
 * or hidden that RLS would have allowed), never a data leak.
 */

export function isHr(role: AppRole): boolean {
  return role === "hr";
}

export function isManagerOrHr(role: AppRole): boolean {
  return role === "manager" || role === "hr";
}

/**
 * Whether `role` may create or delete projects and delete tasks.
 *
 * Unlike every other helper in this file, this mirrors no SQL policy:
 * 0007_tasks_rls.sql leaves `projects` writes and `tasks` deletes open to
 * any authenticated user ("for all ... using (true) with check (true)").
 * The corresponding Server Actions (createProject, deleteProject,
 * deleteTask in app/(app)/tasks/actions.ts) self-check this instead, since
 * there's no RLS layer underneath them to catch a UI bypass.
 */
export function canManageProjects(role: AppRole): boolean {
  return role !== "employee";
}

/** Mirrors `manages(target)`: true when `viewer` manages `target`'s team. */
export function isManagerOf(viewer: Person, target: Person, teams: Team[]): boolean {
  if (!target.teamId) return false;
  const team = teams.find((t) => t.id === target.teamId);
  return team?.managerId === viewer.id;
}

/** Mirrors `can_see_employee(target)`. */
export function canSee(viewer: Person, target: Person, teams: Team[]): boolean {
  return viewer.id === target.id || isHr(viewer.appRole) || isManagerOf(viewer, target, teams);
}

/** Short label for "who you're currently scoped to see", for an empty-state
 *  or a header chip like "Scoped to your team". */
export function scopeLabel(role: AppRole): string {
  switch (role) {
    case "hr":
      return "Organization-wide";
    case "manager":
      return "Your team";
    case "employee":
      return "Just you";
  }
}

/** Filters a list down to what `viewer` can see — for client components that
 *  already have the full list in hand and just need to render the subset. */
export function visibleTo<T extends { id: string }>(
  viewer: Person,
  targets: T[],
  toPerson: (t: T) => Person,
  teams: Team[]
): T[] {
  return targets.filter((t) => canSee(viewer, toPerson(t), teams));
}
