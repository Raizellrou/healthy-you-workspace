export type AppRole = "employee" | "manager" | "hr";

/**
 * The role-aware identity of a signed-in user, distinct from `types/employee.ts`'s
 * `Employee` (which the frozen `lib/supabase/queries.ts` owns and doesn't
 * carry `app_role`/`team_id`). Kept as its own type rather than extending
 * `Employee` so nothing here depends on, or risks colliding with, the
 * frozen shape.
 */
export interface Person {
  id: string;
  name: string;
  email: string;
  team: string;
  teamId: string | null;
  appRole: AppRole;
  timezone: string;
  weeklyCapacityHours: number;
  avatarColor: string;
}

export interface Team {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
}
