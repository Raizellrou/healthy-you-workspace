"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, validated, type ActionResult } from "@/lib/action-result";

/**
 * Reassigns a team's manager and keeps app_role in sync with it: the
 * incoming manager is promoted to 'manager' (unless they're already 'hr' —
 * that's a strictly broader role, never downgraded by a team assignment),
 * and the outgoing manager is demoted back to 'employee', but only if
 * they're not managing some OTHER team too (teams.manager_id has no
 * uniqueness constraint stopping one person from managing more than one).
 *
 * Both this and setHr() rely entirely on RLS to reject the write for a
 * non-HR caller — "hr can manage teams" and "hr can update any employee"
 * (0010_rls_v2.sql) are the actual enforcement. This action doesn't check
 * the caller's role itself; if RLS ever regresses, these calls fail with a
 * Postgres permission error, not a silent no-op.
 *
 * This is the general rule in this codebase, not a universal one: actions
 * rely on RLS wherever RLS actually covers the write, and self-check role
 * only where it doesn't. Tasks/projects are the exception — 0007_tasks_rls.sql
 * leaves project create/delete and task delete open to any authenticated
 * user, so app/(app)/tasks/actions.ts's createProject/deleteProject/deleteTask
 * self-check via lib/authz.ts#canManageProjects instead.
 */
export async function assignManager(
  teamId: string,
  employeeId: string
): Promise<ActionResult> {
  return validated(
    z.object({ teamId: z.uuid(), employeeId: z.uuid() }),
    { teamId, employeeId },
    async ({ teamId, employeeId }) => {
      const supabase = await createClient();

      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .select("manager_id")
        .eq("id", teamId)
        .single();
      if (teamErr || !team) return fail(teamErr?.message ?? "Team not found.");

      const previousManagerId = team.manager_id as string | null;

      const { error: updateTeamErr } = await supabase
        .from("teams")
        .update({ manager_id: employeeId })
        .eq("id", teamId);
      if (updateTeamErr) return fail(updateTeamErr.message);

      const { data: incoming } = await supabase
        .from("employees")
        .select("app_role")
        .eq("id", employeeId)
        .single();
      if (incoming && incoming.app_role === "employee") {
        await supabase.from("employees").update({ app_role: "manager" }).eq("id", employeeId);
      }

      if (previousManagerId && previousManagerId !== employeeId) {
        const { count: stillManaging } = await supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("manager_id", previousManagerId);
        const { data: previous } = await supabase
          .from("employees")
          .select("app_role")
          .eq("id", previousManagerId)
          .single();
        if (!stillManaging && previous?.app_role === "manager") {
          await supabase
            .from("employees")
            .update({ app_role: "employee" })
            .eq("id", previousManagerId);
        }
      }

      revalidatePath("/teams");
      return ok();
    }
  );
}

/**
 * Grants or revokes HR. Revoking drops to 'manager' if the person still
 * manages a team, otherwise 'employee' — never silently strips someone's
 * team-manager status as a side effect of losing HR.
 */
export async function setHr(employeeId: string, grant: boolean): Promise<ActionResult> {
  return validated(
    z.object({ employeeId: z.uuid(), grant: z.boolean() }),
    { employeeId, grant },
    async ({ employeeId, grant }) => {
      const supabase = await createClient();

      let nextRole: "employee" | "manager" | "hr" = "employee";
      if (grant) {
        nextRole = "hr";
      } else {
        const { count } = await supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("manager_id", employeeId);
        nextRole = count && count > 0 ? "manager" : "employee";
      }

      const { error } = await supabase
        .from("employees")
        .update({ app_role: nextRole })
        .eq("id", employeeId);
      if (error) return fail(error.message);

      revalidatePath("/teams");
      return ok();
    }
  );
}
