import { createClient } from "@/lib/supabase/server";
import type { InterventionActionType, InterventionDriverKey } from "@/lib/interventions";

/** Sibling to the frozen `lib/supabase/queries.ts` — interventions didn't
 *  exist before P8, so there's nothing there to collide with; this just
 *  follows the same "reads live outside queries.ts" convention as every
 *  other P3+ table. */

export interface Intervention {
  id: string;
  employeeId: string;
  createdBy: string;
  driver: InterventionDriverKey;
  actionType: InterventionActionType;
  status: "suggested" | "accepted" | "dismissed";
  scoreAtCreation: number;
  note: string | null;
  relatedPtoRequestId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface InterventionRow {
  id: string;
  employee_id: string;
  created_by: string;
  driver: InterventionDriverKey;
  action_type: InterventionActionType;
  status: "suggested" | "accepted" | "dismissed";
  score_at_creation: number;
  note: string | null;
  related_pto_request_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

function toIntervention(row: InterventionRow): Intervention {
  return {
    id: row.id,
    employeeId: row.employee_id,
    createdBy: row.created_by,
    driver: row.driver,
    actionType: row.action_type,
    status: row.status,
    scoreAtCreation: row.score_at_creation,
    note: row.note,
    relatedPtoRequestId: row.related_pto_request_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/** Most-recent-first per employee — the burnout detail panel only ever
 *  shows the latest one to decide what state to render. */
export async function getInterventionsForEmployees(employeeIds: string[]): Promise<Map<string, Intervention[]>> {
  if (employeeIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interventions")
    .select(
      "id, employee_id, created_by, driver, action_type, status, score_at_creation, note, related_pto_request_id, created_at, resolved_at"
    )
    .in("employee_id", employeeIds)
    .order("created_at", { ascending: false })
    .returns<InterventionRow[]>();
  if (error) {
    throw new Error(`Failed to load interventions: ${error.message}`);
  }

  const map = new Map<string, Intervention[]>();
  for (const row of data ?? []) {
    const list = map.get(row.employee_id) ?? [];
    list.push(toIntervention(row));
    map.set(row.employee_id, list);
  }
  return map;
}
