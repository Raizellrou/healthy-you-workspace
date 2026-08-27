/**
 * P8: the workload rebalancer. Pure and unit-tested — a greedy suggestion
 * pass over the same committed/capacity numbers Workload already computes
 * (lib/tasks.ts#buildCapacityWorkload), no new data source. Not an optimal
 * solver: it repeatedly takes the most-overloaded person's biggest open
 * task and gives it to whoever has the most headroom it fits under, until
 * nobody's over 100% or nothing more can move. That's what turns "Rita is
 * at 142%" into a concrete, explainable action instead of just a number.
 */

export interface RebalancePerson {
  employeeId: string;
  name: string;
  committedHours: number;
  capacityHours: number;
}

export interface RebalanceTask {
  id: string;
  title: string;
  assigneeId: string;
  estimateHours: number;
}

export interface RebalanceMove {
  taskId: string;
  taskTitle: string;
  estimateHours: number;
  fromEmployeeId: string;
  fromName: string;
  toEmployeeId: string;
  toName: string;
}

const OVERLOAD_PCT = 100;
const HEADROOM_PCT = 85;
const MAX_MOVES = 6;

function pctLoad(hours: number, capacityHours: number): number {
  if (capacityHours <= 0) return 0;
  return (hours / capacityHours) * 100;
}

/** Greedy, capped at MAX_MOVES so the suggestion list stays a short,
 *  reviewable card rather than a wall of moves. */
export function suggestRebalanceMoves(people: RebalancePerson[], tasks: RebalanceTask[]): RebalanceMove[] {
  const load = new Map(people.map((p) => [p.employeeId, p.committedHours]));
  const capacity = new Map(people.map((p) => [p.employeeId, p.capacityHours]));
  const name = new Map(people.map((p) => [p.employeeId, p.name]));

  const tasksByAssignee = new Map<string, RebalanceTask[]>();
  for (const t of tasks) {
    const list = tasksByAssignee.get(t.assigneeId) ?? [];
    list.push(t);
    tasksByAssignee.set(t.assigneeId, list);
  }

  const moved = new Set<string>();
  const moves: RebalanceMove[] = [];

  for (let i = 0; i < MAX_MOVES; i++) {
    let mostOverloadedId: string | null = null;
    let mostOverloadedPct = OVERLOAD_PCT;
    for (const p of people) {
      const pct = pctLoad(load.get(p.employeeId) ?? 0, capacity.get(p.employeeId) ?? 0);
      if (pct > mostOverloadedPct) {
        mostOverloadedPct = pct;
        mostOverloadedId = p.employeeId;
      }
    }
    if (!mostOverloadedId) break;

    const candidates = (tasksByAssignee.get(mostOverloadedId) ?? [])
      .filter((t) => !moved.has(t.id))
      .sort((a, b) => b.estimateHours - a.estimateHours);

    const receivers = people
      .filter((p) => p.employeeId !== mostOverloadedId)
      .filter((p) => pctLoad(load.get(p.employeeId) ?? 0, capacity.get(p.employeeId) ?? 0) < HEADROOM_PCT)
      .sort((a, b) => pctLoad(load.get(a.employeeId) ?? 0, a.capacityHours) - pctLoad(load.get(b.employeeId) ?? 0, b.capacityHours));

    let placed = false;
    for (const task of candidates) {
      const receiver = receivers.find((r) => {
        const cap = capacity.get(r.employeeId) ?? 0;
        return cap > 0 && ((load.get(r.employeeId) ?? 0) + task.estimateHours) / cap * 100 <= OVERLOAD_PCT;
      });
      if (!receiver) continue;

      load.set(mostOverloadedId, (load.get(mostOverloadedId) ?? 0) - task.estimateHours);
      load.set(receiver.employeeId, (load.get(receiver.employeeId) ?? 0) + task.estimateHours);
      moved.add(task.id);
      moves.push({
        taskId: task.id,
        taskTitle: task.title,
        estimateHours: task.estimateHours,
        fromEmployeeId: mostOverloadedId,
        fromName: name.get(mostOverloadedId) ?? "",
        toEmployeeId: receiver.employeeId,
        toName: name.get(receiver.employeeId) ?? "",
      });
      placed = true;
      break;
    }

    // No task from the current most-overloaded person fits anywhere with
    // headroom to spare — trying them again next iteration would repeat
    // the same failed search, so stop rather than loop uselessly.
    if (!placed) break;
  }

  return moves;
}
